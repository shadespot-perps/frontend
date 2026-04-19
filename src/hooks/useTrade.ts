import { useState, useCallback } from 'react';
import {
  useWriteContract,
  useReadContract,
  usePublicClient,
  useAccount,
} from 'wagmi';
import { parseUnits, parseAbiItem, type WriteContractParameters } from 'viem';
import { Encryptable } from '@cofhe/sdk';
import {
  CONTRACTS, INDEX_TOKEN, TOKEN_DECIMALS,
  FHE_ROUTER_ABI, FHE_TOKEN_ABI,
  PRICE_ORACLE_ABI, VAULT_EVENTS_ABI,
} from '@/lib/contracts';
import { cofheClient, normaliseEnc, toHexSig } from '@/hooks/useCofhe';

async function withFreshGas(
  publicClient: ReturnType<typeof usePublicClient>,
): Promise<Pick<WriteContractParameters, 'maxFeePerGas' | 'maxPriorityFeePerGas'>> {
  if (!publicClient) return {};
  try {
    const fees = await publicClient.estimateFeesPerGas();
    const buf = (v: bigint) => (v * 130n) / 100n;
    return {
      maxFeePerGas:         buf(fees.maxFeePerGas         ?? 0n),
      maxPriorityFeePerGas: buf(fees.maxPriorityFeePerGas ?? 0n),
    };
  } catch {
    return {};
  }
}

export type TradeStatus =
  | 'idle'
  | 'setting_operator'
  | 'encrypting'          // FHE proof generation
  | 'submitting'          // tx in wallet
  | 'fhe_decrypt_sent'    // phase-1 confirmed, waiting for CoFHE TN decrypt
  | 'confirmed'
  | 'error';

/**
 * Open-position flow (FHE):
 *   Market: setOperator? → encryptInputs → submitDecryptTaskForOpen
 *           → wait for receipt → read hasLiqHandle → decryptForTx
 *           → openPosition(same ciphertexts + proof)
 *   Limit/stop: setOperator? → encryptInputs → createOrder
 */
export function useOpenPosition() {
  const [status, setStatus] = useState<TradeStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { address: walletAddress } = useAccount();

  const { data: actionFeeRaw } = useReadContract({
    address: CONTRACTS.router,
    abi: FHE_ROUTER_ABI,
    functionName: 'actionFee',
    query: { enabled: true },
  });
  const actionFee = (actionFeeRaw as bigint | undefined) ?? 0n;

  const { data: isOperatorRaw, refetch: refetchOperator } = useReadContract({
    address: CONTRACTS.fheToken,
    abi: FHE_TOKEN_ABI,
    functionName: 'isOperator',
    args: [walletAddress!, CONTRACTS.router],
    query: { enabled: !!walletAddress },
  });

  const publicClient               = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();

  const execute = useCallback(async (params: {
    collateral: number;
    leverage: number;
    isLong: boolean;
    orderType: 'market' | 'limit' | 'stop';
    triggerPrice?: number;
  }) => {
    if (!walletAddress) return;
    setError(null);

    try {
      const gas = await withFreshGas(publicClient);

      // ── 1. Ensure operator permission ───────────────────────────
      if (!isOperatorRaw) {
        setStatus('setting_operator');
        const oneYear = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
        await write({
          address: CONTRACTS.fheToken,
          abi: FHE_TOKEN_ABI,
          functionName: 'setOperator',
          args: [CONTRACTS.router, oneYear],
          ...gas,
        });
        await refetchOperator();
      }

      const collateralWei = parseUnits(params.collateral.toString(), TOKEN_DECIMALS);

      // ── 2. Limit / stop order ───────────────────────────────────
      if (params.orderType !== 'market') {
        if (!params.triggerPrice) throw new Error('triggerPrice required for limit/stop orders');

        setStatus('encrypting');
        const [eCollateral, eLeverage, eTriggerPrice, eIsLong] = await cofheClient
          .encryptInputs([
            Encryptable.uint64(collateralWei),
            Encryptable.uint64(BigInt(params.leverage)),
            Encryptable.uint128(parseUnits(params.triggerPrice.toString(), TOKEN_DECIMALS)),
            Encryptable.bool(params.isLong),
          ])
          .execute();

        setStatus('submitting');
        const freshGas = await withFreshGas(publicClient);
        await write({
          address: CONTRACTS.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'createOrder',
          args: [
            INDEX_TOKEN,
            normaliseEnc(eCollateral),
            normaliseEnc(eLeverage),
            normaliseEnc(eTriggerPrice),
            normaliseEnc(eIsLong),
          ],
          value: actionFee,
          ...freshGas,
        });
        setStatus('confirmed');
        return;
      }

      // ── 3. Market order — two-phase FHE open ────────────────────
      setStatus('encrypting');
      // Encrypt all three inputs in one ZKPoK batch.
      const [eCollateral, eLeverage, eIsLong] = await cofheClient
        .encryptInputs([
          Encryptable.uint64(collateralWei),
          Encryptable.uint64(BigInt(params.leverage)),
          Encryptable.bool(params.isLong),
        ])
        .execute();

      // Normalise signatures for viem tuple encoding.
      const encC = normaliseEnc(eCollateral);
      const encL = normaliseEnc(eLeverage);
      const encI = normaliseEnc(eIsLong);

      // Phase 1: submit FHE liquidity check task
      setStatus('submitting');
      const phase1Gas = await withFreshGas(publicClient);
      const phase1Hash = await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'submitDecryptTaskForOpen',
        args: [INDEX_TOKEN, encC, encL, encI],
        ...phase1Gas,
      });

      setStatus('fhe_decrypt_sent');

      // Wait for phase-1 receipt, then read hasLiqHandle from FHEVault event.
      const receipt = await publicClient!.waitForTransactionReceipt({
        hash: phase1Hash,
        timeout: 120_000,
      });

      const liqLogs = await publicClient!.getLogs({
        address: CONTRACTS.vault as `0x${string}`,
        event: parseAbiItem(
          'event ReserveLiquidityCheckSubmitted(address indexed trader, bytes32 hasLiqHandle, bytes32 sizeHandle)'
        ),
        args: { trader: walletAddress },
        fromBlock: receipt.blockNumber,
        toBlock:   receipt.blockNumber,
      });

      const hasLiqHandle = liqLogs[0]?.args?.hasLiqHandle;
      if (!hasLiqHandle) throw new Error('ReserveLiquidityCheckSubmitted event not found');

      // Off-chain decrypt via CoFHE Threshold Network.
      // FHEVault calls FHE.allow(hasLiq, trader) so the trader's self-permit is sufficient.
      const permit = await cofheClient.permits.getOrCreateSelfPermit();
      const decryptResult = await cofheClient
        .decryptForTx(BigInt(hasLiqHandle))
        .withPermit(permit)
        .execute();

      const hasLiqPlain = decryptResult.decryptedValue !== 0n;
      const hasLiqSig   = toHexSig(decryptResult.signature);

      // Phase 2: open position with proof
      setStatus('submitting');
      const phase2Gas = await withFreshGas(publicClient);
      await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'openPosition',
        // Re-use the SAME ciphertexts (same ctHash) from phase 1.
        args: [INDEX_TOKEN, encC, encL, encI, hasLiqPlain, hasLiqSig],
        value: actionFee,
        ...phase2Gas,
      });

      setStatus('confirmed');

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStatus('error');
    }
  }, [walletAddress, actionFee, isOperatorRaw, write, refetchOperator, publicClient]);

  const reset = useCallback(() => { setStatus('idle'); setError(null); }, []);

  return { execute, status, error, reset };
}

/**
 * Close an open position.
 * Sends closePosition(positionId) — positionId = getPositionKey(trader, token, isLong).
 * The PositionManager then runs the async FHE close flow (CloseRequested → finalize).
 */
export function useClosePosition() {
  const [status, setStatus] = useState<TradeStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { data: actionFeeRaw } = useReadContract({
    address: CONTRACTS.router,
    abi: FHE_ROUTER_ABI,
    functionName: 'actionFee',
    query: { enabled: true },
  });
  const actionFee = (actionFeeRaw as bigint | undefined) ?? 0n;

  const publicClient               = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();

  const execute = useCallback(async (positionKey: `0x${string}`) => {
    setError(null);
    try {
      const gas = await withFreshGas(publicClient);
      setStatus('submitting');
      await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'closePosition',
        args: [positionKey],
        value: actionFee,
        ...gas,
      });
      setStatus('confirmed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStatus('error');
    }
  }, [actionFee, write, publicClient]);

  return { execute, status, error };
}

/** Cancel a pending limit/stop order (no fee required). */
export function useCancelOrder() {
  const [status, setStatus] = useState<TradeStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const publicClient               = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();

  const execute = useCallback(async (orderId: number) => {
    setError(null);
    try {
      const gas = await withFreshGas(publicClient);
      setStatus('submitting');
      await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'cancelOrder',
        args: [BigInt(orderId)],
        ...gas,
      });
      setStatus('confirmed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStatus('error');
    }
  }, [write, publicClient]);

  return { execute, status, error };
}

const ORACLE_STALE_SECONDS = 300;

export function useTradePrecheck(collateralUsd: number, leverage: number) {
  const { data: priceData } = useReadContract({
    address: CONTRACTS.priceOracle,
    abi: PRICE_ORACLE_ABI,
    functionName: 'getPriceData',
    args: [INDEX_TOKEN],
    query: { refetchInterval: 10_000 },
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const [pricePlain, lastUpdated] = (priceData as [bigint, bigint] | undefined) ?? [0n, 0n];
  const priceAge       = lastUpdated > 0n ? nowSec - Number(lastUpdated) : null;
  const oracleNeverSet = pricePlain === 0n;
  const oracleStale    = !oracleNeverSet && priceAge != null && priceAge > ORACLE_STALE_SECONDS;
  const oracleOk       = !oracleNeverSet && !oracleStale;

  const requiredLiq = collateralUsd * leverage;

  const warnings: string[] = [];
  if (oracleNeverSet) {
    warnings.push('Oracle price not set — run `npm run update-price` in sdk/.');
  } else if (oracleStale) {
    warnings.push(`Oracle price is stale (${priceAge}s old, max 300s) — run \`npm run update-price\` in sdk/.`);
  }

  return {
    oracleOk,
    oracleNeverSet,
    oracleStale,
    priceAge,
    liquidityOk: true,
    availLiq: null,
    requiredLiq,
    warnings,
    ready: oracleOk,
  };
}

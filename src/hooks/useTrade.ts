import { useState, useCallback } from 'react';
import {
  useWriteContract,
  useReadContract,
  usePublicClient,
  useAccount,
} from 'wagmi';
import { parseUnits, parseAbiItem, decodeEventLog, type WriteContractParameters } from 'viem';
import { Encryptable } from '@cofhe/sdk';
import {
  CONTRACTS, INDEX_TOKEN, TOKEN_DECIMALS,
  FHE_ROUTER_ABI, FHE_TOKEN_ABI,
  PRICE_ORACLE_ABI, VAULT_EVENTS_ABI,
  POSITION_MANAGER_ABI,
} from '@/lib/contracts';
import { decryptForTxWithRetry, encryptInputsOnChain, isCofheReady, normaliseEnc, toHexSig } from '@/hooks/useCofhe';

// Manual gas override removed to let Viem natively negotiate Arbitrum L2 fees

export type TradeStatus =
  | 'idle'
  | 'setting_operator'
  | 'encrypting'          // FHE proof generation
  | 'submitting'          // tx in wallet
  | 'fhe_decrypt_sent'    // phase-1 confirmed, waiting for CoFHE TN decrypt
  | 'awaiting_decrypt'    // waiting for CoFHE TN decrypt during close finalization
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
      if (!isCofheReady()) throw new Error('CoFHE client not ready — wallet still connecting, please try again in a moment');
      // ── 1. Ensure operator permission ───────────────────────────
      if (!isOperatorRaw) {
        setStatus('setting_operator');
        const oneYear = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
        const fees = await publicClient!.estimateFeesPerGas();
        await write({
          address: CONTRACTS.fheToken,
          abi: FHE_TOKEN_ABI,
          functionName: 'setOperator',
          args: [CONTRACTS.router, oneYear],
          gas: 100_000n,  // simple storage write — bypass broken MetaMask CoFHE sim
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
        await refetchOperator();
      }

      const collateralWei = parseUnits(params.collateral.toString(), TOKEN_DECIMALS);

      // ── 2. Limit / stop order ───────────────────────────────────
      if (params.orderType !== 'market') {
        if (!params.triggerPrice) throw new Error('triggerPrice required for limit/stop orders');

        setStatus('encrypting');
        const [eCollateral, eLeverage, eTriggerPrice, eIsLong] = await encryptInputsOnChain([
          Encryptable.uint64(collateralWei),
          Encryptable.uint64(BigInt(params.leverage)),
          // Oracle prices are 8 decimals on-chain; triggerPrice must use same scale.
          Encryptable.uint128(parseUnits(params.triggerPrice.toString(), 8)),
          Encryptable.bool(params.isLong),
        ]);

        setStatus('submitting');
        const fees = await publicClient!.estimateFeesPerGas();
        await write({
          address: CONTRACTS.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'createEncryptedOrder',
          args: [
            INDEX_TOKEN,
            normaliseEnc(eCollateral),
            normaliseEnc(eLeverage),
            normaliseEnc(eTriggerPrice),
            normaliseEnc(eIsLong),
          ],
          // CoFHE ops + FHERC20 transfer + storage writes are gas-heavy on Arbitrum.
          // Keep a high explicit limit to avoid silent revert-at-cap.
          gas: 2_000_000n,
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
        setStatus('confirmed');
        return;
      }

      // ── 3. Market order — two-phase FHE open ────────────────────
      setStatus('encrypting');
      // Encrypt all three inputs in one ZKPoK batch.
      const [eCollateral, eLeverage, eIsLong] = await encryptInputsOnChain([
        Encryptable.uint64(collateralWei),
        Encryptable.uint64(BigInt(params.leverage)),
        Encryptable.bool(params.isLong),
      ]);

      // Normalise signatures for viem tuple encoding.
      const encC = normaliseEnc(eCollateral);
      const encL = normaliseEnc(eLeverage);
      const encI = normaliseEnc(eIsLong);

      // Phase 1: submit FHE liquidity check task
      setStatus('submitting');
      const phase1Fees = await publicClient!.estimateFeesPerGas();
      const phase1Hash = await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'submitOpenPositionCheck',
        args: [INDEX_TOKEN, encC, encL, encI],
        gas: 2_500_000n,
        maxFeePerGas: phase1Fees.maxFeePerGas,
        maxPriorityFeePerGas: phase1Fees.maxPriorityFeePerGas,
      });

      setStatus('fhe_decrypt_sent');

      // Wait for phase-1 receipt, then read hasLiq handle directly from vault state.
      // This is more robust than relying on immediate event indexing.
      const receipt = await publicClient!.waitForTransactionReceipt({
        hash: phase1Hash,
        timeout: 120_000,
      });
      const traderForCheck = (receipt.from ?? walletAddress) as `0x${string}`;
      const ZERO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
      let hasLiqHandle: `0x${string}` | undefined;

      // Primary source: decode hasLiq handle from the mined tx receipt logs.
      // This avoids any ambiguity around mapping keys and RPC log indexing delays.
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== CONTRACTS.vault.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: [parseAbiItem('event ReserveLiquidityCheckSubmitted(address indexed trader, bytes32 hasLiqHandle, bytes32 sizeHandle)')],
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'ReserveLiquidityCheckSubmitted') {
            hasLiqHandle = decoded.args.hasLiqHandle as `0x${string}`;
          }
        } catch {
          // ignore non-matching logs
        }
      }

      const readPendingHandle = async (trader: `0x${string}`): Promise<`0x${string}` | undefined> => {
        const pending = await publicClient!.readContract({
          address: CONTRACTS.vault as `0x${string}`,
          abi: [
            {
              type: 'function',
              name: 'pendingLiqCheck',
              stateMutability: 'view',
              inputs: [{ name: 'trader', type: 'address' }],
              outputs: [
                { name: 'hasLiq', type: 'bytes32' },
                { name: 'eSize', type: 'bytes32' },
              ],
            },
          ] as const,
          functionName: 'pendingLiqCheck',
          args: [trader],
        });

        if (Array.isArray(pending)) return pending[0] as `0x${string}`;
        if (pending && typeof pending === 'object' && 'hasLiq' in pending) {
          return (pending as { hasLiq: `0x${string}` }).hasLiq;
        }
        return undefined;
      };

      // Some RPCs can lag right after receipt; poll briefly before failing.
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      for (let i = 0; i < 8 && (!hasLiqHandle || hasLiqHandle === ZERO_HANDLE); i++) {
        hasLiqHandle = await readPendingHandle(traderForCheck);
        if ((!hasLiqHandle || hasLiqHandle === ZERO_HANDLE) && walletAddress) {
          hasLiqHandle = await readPendingHandle(walletAddress as `0x${string}`);
        }
        if (!hasLiqHandle || hasLiqHandle === ZERO_HANDLE) {
          await sleep(1000);
        }
      }

      // Fallback to event lookup if tuple decoding format differs by client/provider.
      if (!hasLiqHandle || hasLiqHandle === ZERO_HANDLE) {
        // Last-chance scan up to latest in case indexer lagged at receipt block.
        const liqLogs = await publicClient!.getLogs({
          address: CONTRACTS.vault as `0x${string}`,
          event: parseAbiItem(
            'event ReserveLiquidityCheckSubmitted(address indexed trader, bytes32 hasLiqHandle, bytes32 sizeHandle)'
          ),
          args: { trader: traderForCheck },
          fromBlock: receipt.blockNumber > 5_000n ? receipt.blockNumber - 5_000n : 0n,
          toBlock: 'latest',
        });
        hasLiqHandle = liqLogs[liqLogs.length - 1]?.args?.hasLiqHandle as `0x${string}` | undefined;
      }

      if (!hasLiqHandle || hasLiqHandle === ZERO_HANDLE) {
        throw new Error('pendingLiqCheck has no hasLiq handle after submitOpenPositionCheck');
      }

      // Off-chain decrypt via CoFHE Threshold Network.
      // FHEVault calls FHE.allow(hasLiq, trader) so the trader's self-permit is sufficient.
      const decryptResult = await decryptForTxWithRetry(BigInt(hasLiqHandle), {
        label: 'open.hasLiq',
        retries: 15,
        delayMs: 5000,
        tryWithoutPermitFallback: true,
      });

      const hasLiqPlain = decryptResult.decryptedValue !== 0n;
      const hasLiqSig   = toHexSig(decryptResult.signature);

      // Phase 2: open position with proof
      setStatus('submitting');
      const phase2Fees = await publicClient!.estimateFeesPerGas();
      await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'finalizeOpenPosition',
        // Re-use the SAME ciphertexts (same ctHash) from phase 1.
        args: [INDEX_TOKEN, encC, encL, encI, hasLiqPlain, hasLiqSig],
        gas: 3_000_000n,
        maxFeePerGas: phase2Fees.maxFeePerGas,
        maxPriorityFeePerGas: phase2Fees.maxPriorityFeePerGas,
      });

      setStatus('confirmed');

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStatus('error');
    }
  }, [walletAddress, isOperatorRaw, write, refetchOperator, publicClient]);

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

  const publicClient               = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();
  const { address: walletAddress } = useAccount();

  const execute = useCallback(async (positionKey: `0x${string}`) => {
    setError(null);
    try {
      if (!walletAddress) throw new Error('Wallet not connected');
      if (!isCofheReady()) throw new Error('CoFHE client not ready — wallet still connecting, please try again in a moment');

      // PriceOracle.getPrice() reverts if price is stale; catch it here with a friendlier error.
      const priceData = await publicClient!.readContract({
        address: CONTRACTS.priceOracle,
        abi: PRICE_ORACLE_ABI,
        functionName: 'getPriceData',
        args: [INDEX_TOKEN],
      }) as [bigint, bigint];
      const [price, lastUpdated] = priceData;
      if (price === 0n) throw new Error('Oracle price not set — run `npm run update-price` in `shadespot/sdk`');
      const nowSec = Math.floor(Date.now() / 1000);
      const ageSec = nowSec - Number(lastUpdated);
      if (ageSec > ORACLE_STALE_SECONDS) {
        throw new Error(`Oracle price is stale (${ageSec}s old, max ${ORACLE_STALE_SECONDS}s) — run \`npm run update-price\` in \`shadespot/sdk\` then retry`);
      }

      // Quick sanity check: prevent burning gas on an invalid key.
      const exists = await publicClient!.readContract({
        address: CONTRACTS.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'positionExists',
        args: [positionKey],
      }) as boolean;
      if (!exists) {
        throw new Error(`Position does not exist for key ${positionKey} (likely wrong key was passed)`);
      }

      // Phase 1: request close (on-chain)
      setStatus('submitting');
      const fees1 = await publicClient!.estimateFeesPerGas();
      const phase1Hash = await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'requestClosePosition',
        args: [positionKey],
        gas: 3_000_000n,
        maxFeePerGas: fees1.maxFeePerGas,
        maxPriorityFeePerGas: fees1.maxPriorityFeePerGas,
      });

      setStatus('awaiting_decrypt');

      const receipt = await publicClient!.waitForTransactionReceipt({
        hash: phase1Hash,
        timeout: 120_000,
      });

      // Extract CloseRequested handles from receipt logs (PositionManager emits it).
      const pmAddr = CONTRACTS.positionManager.toLowerCase();
      type CloseRequestedEvent = {
        args: {
          positionKey: `0x${string}`;
          trader: `0x${string}`;
          finalAmountHandle: `0x${string}`;
          sizeHandle: `0x${string}`;
        };
      };

      const closeLogs = receipt.logs
        .filter(l => l.address.toLowerCase() === pmAddr)
        .map(l => {
          try {
            return decodeEventLog({
              abi: [parseAbiItem('event CloseRequested(bytes32 indexed positionKey, address indexed trader, bytes32 finalAmountHandle, bytes32 sizeHandle)')],
              data: l.data,
              topics: l.topics,
            });
          } catch {
            return null;
          }
        })
        .filter(Boolean) as CloseRequestedEvent[];

      const closeEvt = closeLogs.find(e => e.args?.positionKey === positionKey) ?? closeLogs[0];
      const finalAmountHandle = closeEvt?.args?.finalAmountHandle as `0x${string}` | undefined;
      const sizeHandle = closeEvt?.args?.sizeHandle as `0x${string}` | undefined;

      if (!finalAmountHandle || !sizeHandle) {
        throw new Error('CloseRequested event not found in receipt logs');
      }

      // Find collateral handle from PositionOpened (emitted when the position was opened).
      // We scan a recent window to keep RPC load reasonable.
      const fromBlock = receipt.blockNumber > 10_000n ? receipt.blockNumber - 10_000n : 0n;
      const openedLogs = await publicClient!.getLogs({
        address: CONTRACTS.positionManager as `0x${string}`,
        event: parseAbiItem(
          'event PositionOpened(bytes32 indexed positionKey, address indexed trader, bytes32 sizeHandle, bytes32 collateralHandle, bytes32 isLongHandle)'
        ),
        args: { positionKey, trader: walletAddress as `0x${string}` },
        fromBlock,
        toBlock: 'latest',
      });

      const collateralHandle = openedLogs[openedLogs.length - 1]?.args?.collateralHandle as `0x${string}` | undefined;
      if (!collateralHandle) {
        throw new Error('PositionOpened(collateralHandle) not found for this positionKey');
      }

      // Off-chain decrypt with CoFHE TN (signatures used for publishDecryptResult on-chain).
      const [finalAmount, size, collateral] = await Promise.all([
        decryptForTxWithRetry(BigInt(finalAmountHandle), { label: 'close.finalAmount', retries: 20, delayMs: 5000, tryWithoutPermitFallback: true }),
        decryptForTxWithRetry(BigInt(sizeHandle), { label: 'close.size', retries: 20, delayMs: 5000, tryWithoutPermitFallback: true }),
        decryptForTxWithRetry(BigInt(collateralHandle), { label: 'close.collateral', retries: 20, delayMs: 5000, tryWithoutPermitFallback: true }),
      ]);

      // Phase 2: finalize close (on-chain)
      setStatus('submitting');
      const fees2 = await publicClient!.estimateFeesPerGas();
      await write({
        address: CONTRACTS.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'finalizeClosePosition',
        args: [
          positionKey,
          finalAmount.decryptedValue,
          toHexSig(finalAmount.signature),
          size.decryptedValue,
          toHexSig(size.signature),
          collateral.decryptedValue,
          toHexSig(collateral.signature),
          false,
        ],
        gas: 3_000_000n,
        maxFeePerGas: fees2.maxFeePerGas,
        maxPriorityFeePerGas: fees2.maxPriorityFeePerGas,
      });

      setStatus('confirmed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStatus('error');
    }
  }, [write, publicClient, walletAddress]);

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
      setStatus('submitting');
      const fees = await publicClient!.estimateFeesPerGas();
      await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'cancelOrder',
        args: [BigInt(orderId)],
        gas: 200_000n,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
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
    warnings.push('Oracle price not set.');
  } else if (oracleStale) {
    warnings.push(`Oracle price is stale (${priceAge}s old, max ${ORACLE_STALE_SECONDS}s).`);
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

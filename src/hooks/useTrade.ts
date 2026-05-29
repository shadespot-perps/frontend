import { useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import {
  useWriteContract,
  useReadContract,
  usePublicClient,
  useAccount,
  useChainId,
} from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { Encryptable } from '@cofhe/sdk';
import {
  getContracts, getFromBlock, getIndexToken, TOKEN_DECIMALS,
  FHE_ROUTER_ABI, FHE_ROUTER_READ_ABI, FHE_TOKEN_ABI, FHE_VAULT_ABI,
  PRICE_ORACLE_ABI,
  POSITION_MANAGER_ABI,
} from '@/lib/contracts';
import { assertUint64Amount, UINT64_MAX, type CollateralMode } from '@/lib/composability';
import { waitForCloseSettledByKeeper, type ClosePayoutMode } from '@/lib/closePayout';
import { resolveOpenLiquidityProof } from '@/lib/tradeLiquidity';
import { encryptInputsOnChain, isCofheReady, normaliseEnc } from '@/hooks/useCofhe';
import { useApproveUnderlying } from '@/hooks/useApproveUnderlying';
import { formatWalletError } from '@/lib/walletErrors';
import { positionKeysFromReceipt, recordPositionKey, removePositionKey } from '@/lib/positionIndex';
import {
  useUnderlyingTokenMeta,
  useWrapUnderlyingAllowance,
  useWrapUnderlyingBalance,
} from '@/hooks/useUnderlyingToken';

// Manual gas override removed to let Viem natively negotiate Arbitrum L2 fees

export type TradeStatus =
  | 'idle'
  | 'setting_operator'
  | 'approving_underlying'
  | 'encrypting'          // FHE proof generation
  | 'submitting'          // tx in wallet
  | 'fhe_decrypt_sent'    // phase-1 confirmed, waiting for CoFHE TN decrypt
  | 'awaiting_decrypt'    // waiting for CoFHE TN decrypt (open flow)
  | 'awaiting_finalizer'  // close: backend keeper finalizing on-chain
  | 'confirmed'
  | 'error';

export type { CollateralMode };

/** User-visible close flow: wallet requests close, backend finalizer settles on-chain. */
export type CloseStep = 'idle' | 'request' | 'keeper' | 'done';

export const CLOSE_STEP_LABELS: Record<Exclude<CloseStep, 'idle'>, string> = {
  request: 'Step 1/2: Requesting close on-chain…',
  keeper: 'Step 2/2: Backend finalizing settlement…',
  done: 'Position closed',
};

export type { ClosePayoutMode };

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
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const fromBlockDefault = getFromBlock(chainId);
  const indexToken = getIndexToken(chainId);

  const { data: isOperatorRaw, refetch: refetchOperator } = useReadContract({
    address: contracts.fheToken,
    abi: FHE_TOKEN_ABI,
    functionName: 'isOperator',
    args: [walletAddress!, contracts.router],
    query: { enabled: !!walletAddress },
  });

  const publicClient               = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();
  const { approve: approveUnderlying, hasEnoughAllowance } = useApproveUnderlying();
  const underlyingMeta = useUnderlyingTokenMeta();

  const execute = useCallback(async (params: {
    collateral: number;
    leverage: number;
    isLong: boolean;
    orderType: 'market' | 'limit' | 'stop';
    triggerPrice?: number;
    collateralMode?: CollateralMode;
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
          address: contracts.fheToken,
          abi: FHE_TOKEN_ABI,
          functionName: 'setOperator',
          args: [contracts.router, oneYear],
          gas: 100_000n,  // simple storage write — bypass broken MetaMask CoFHE sim
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
        await refetchOperator();
      }

      const collateralWei = parseUnits(params.collateral.toString(), TOKEN_DECIMALS);
      const collateralMode = params.collateralMode ?? 'encrypted';

      if (collateralMode === 'wrap') {
        if (params.orderType !== 'market') {
          throw new Error('Wrap-from-underlying is only supported for market orders');
        }
        if (!underlyingMeta.wrapConfigured) {
          throw new Error(
            'Plain wrap is not enabled on this network — vault/router underlyingToken is unset. ' +
              'Use encrypted collateral (mint FHE token on /dev/faucet) or call vault.setUnderlyingToken after deploying a plain ERC-20.',
          );
        }
      }

      // ── 2. Limit / stop order ───────────────────────────────────
      if (params.orderType !== 'market') {
        if (!params.triggerPrice) throw new Error('triggerPrice required for limit/stop orders');

        setStatus('encrypting');
        const [eCollateral, eLeverage, eTriggerPrice, eIsLong] = await encryptInputsOnChain(chainId, [
          Encryptable.uint64(collateralWei),
          Encryptable.uint64(BigInt(params.leverage)),
          // Oracle prices are 8 decimals on-chain; triggerPrice must use same scale.
          Encryptable.uint128(parseUnits(params.triggerPrice.toString(), 8)),
          Encryptable.bool(params.isLong),
        ]);

        setStatus('submitting');
        const fees = await publicClient!.estimateFeesPerGas();
        await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'createEncryptedOrder',
          args: [
            indexToken,
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

      // ── 3. Market order — two-phase open ────────────────────────
      if (collateralMode === 'wrap') {
        if (!hasEnoughAllowance(collateralWei)) {
          setStatus('approving_underlying');
          await approveUnderlying(collateralWei);
        }

        setStatus('encrypting');
        const plainCollateral = Number(assertUint64Amount(collateralWei));
        const [eLeverage, eIsLong] = await encryptInputsOnChain(chainId, [
          Encryptable.uint64(BigInt(params.leverage)),
          Encryptable.bool(params.isLong),
        ]);
        const encL = normaliseEnc(eLeverage);
        const encI = normaliseEnc(eIsLong);

        setStatus('submitting');
        const phase1Fees = await publicClient!.estimateFeesPerGas();
        const phase1Hash = await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'submitOpenPositionCheckPlain',
          args: [indexToken, plainCollateral, encL, encI],
          gas: 2_500_000n,
          maxFeePerGas: phase1Fees.maxFeePerGas,
          maxPriorityFeePerGas: phase1Fees.maxPriorityFeePerGas,
        });

        setStatus('fhe_decrypt_sent');
        const { hasLiqPlain, hasLiqSig } = await resolveOpenLiquidityProof(
          publicClient!,
          chainId,
          contracts,
          walletAddress as `0x${string}`,
          phase1Hash,
        );

        setStatus('submitting');
        const phase2Fees = await publicClient!.estimateFeesPerGas();
        const openHash = await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'finalizeOpenPositionPlain',
          args: [indexToken, plainCollateral, encL, encI, hasLiqPlain, hasLiqSig],
          gas: 3_000_000n,
          maxFeePerGas: phase2Fees.maxFeePerGas,
          maxPriorityFeePerGas: phase2Fees.maxPriorityFeePerGas,
        });
        const openReceipt = await publicClient!.waitForTransactionReceipt({ hash: openHash });
        for (const key of positionKeysFromReceipt(openReceipt, contracts.positionManager, contracts.router)) {
          recordPositionKey(chainId, walletAddress as `0x${string}`, key, Number(openReceipt.blockNumber));
        }
      } else {
        setStatus('encrypting');
        const [eCollateral, eLeverage, eIsLong] = await encryptInputsOnChain(chainId, [
          Encryptable.uint64(collateralWei),
          Encryptable.uint64(BigInt(params.leverage)),
          Encryptable.bool(params.isLong),
        ]);

        const encC = normaliseEnc(eCollateral);
        const encL = normaliseEnc(eLeverage);
        const encI = normaliseEnc(eIsLong);

        setStatus('submitting');
        const phase1Fees = await publicClient!.estimateFeesPerGas();
        const phase1Hash = await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'submitOpenPositionCheck',
          args: [indexToken, encC, encL, encI],
          gas: 2_500_000n,
          maxFeePerGas: phase1Fees.maxFeePerGas,
          maxPriorityFeePerGas: phase1Fees.maxPriorityFeePerGas,
        });

        setStatus('fhe_decrypt_sent');
        const { hasLiqPlain, hasLiqSig } = await resolveOpenLiquidityProof(
          publicClient!,
          chainId,
          contracts,
          walletAddress as `0x${string}`,
          phase1Hash,
        );

        setStatus('submitting');
        const phase2Fees = await publicClient!.estimateFeesPerGas();
        const openHash = await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'finalizeOpenPosition',
          args: [indexToken, encC, encL, encI, hasLiqPlain, hasLiqSig],
          gas: 3_000_000n,
          maxFeePerGas: phase2Fees.maxFeePerGas,
          maxPriorityFeePerGas: phase2Fees.maxPriorityFeePerGas,
        });
        const openReceipt = await publicClient!.waitForTransactionReceipt({ hash: openHash });
        for (const key of positionKeysFromReceipt(openReceipt, contracts.positionManager, contracts.router)) {
          recordPositionKey(chainId, walletAddress as `0x${string}`, key, Number(openReceipt.blockNumber));
        }
      }

      setStatus('confirmed');

    } catch (err: unknown) {
      setError(formatWalletError(err));
      setStatus('error');
    }
  }, [
    walletAddress,
    isOperatorRaw,
    write,
    refetchOperator,
    publicClient,
    approveUnderlying,
    hasEnoughAllowance,
    underlyingMeta.configured,
  ]);

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
  const [closeStep, setCloseStep] = useState<CloseStep>('idle');
  const [error, setError]   = useState<string | null>(null);

  const publicClient               = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();
  const { address: walletAddress } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const indexToken = getIndexToken(chainId);

  const reset = useCallback(() => {
    setStatus('idle');
    setCloseStep('idle');
    setError(null);
  }, []);

  const execute = useCallback(async (
    positionKey: `0x${string}`,
    options?: { payout?: ClosePayoutMode; isLong?: boolean },
  ) => {
    setError(null);
    setCloseStep('request');
    const payout = options?.payout ?? 'encrypted';

    try {
      if (!walletAddress) throw new Error('Wallet not connected');

      // PriceOracle.getPrice() reverts if price is stale; catch it here with a friendlier error.
      const priceData = await publicClient!.readContract({
        address: contracts.priceOracle,
        abi: PRICE_ORACLE_ABI,
        functionName: 'getPriceData',
        args: [indexToken],
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
        address: contracts.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'positionExists',
        args: [positionKey],
      }) as boolean;
      if (!exists) {
        throw new Error(`Position does not exist for key ${positionKey} (likely wrong key was passed)`);
      }

      if (payout === 'plain') {
        const reserve = await publicClient!.readContract({
          address: contracts.vault,
          abi: FHE_VAULT_ABI,
          functionName: 'plainUnderlyingReserve',
        }) as bigint;
        if (reserve === 0n) {
          throw new Error(
            'Vault has no plain underlying reserve for USDC payout. Deposit plain LP on Earn or open with wrap-USDC collateral first.',
          );
        }
      }

      // Phase 1: request close (on-chain)
      setStatus('submitting');
      const fees1 = await publicClient!.estimateFeesPerGas();
      const requestFn =
        options?.payout === 'plain' ? 'requestClosePlainPayout' : 'requestClosePosition';

      const phase1Hash = await write({
        address: contracts.router,
        abi: FHE_ROUTER_ABI,
        functionName: requestFn,
        args: [positionKey],
        gas: 3_000_000n,
        maxFeePerGas: fees1.maxFeePerGas,
        maxPriorityFeePerGas: fees1.maxPriorityFeePerGas,
      });

      const receipt = await publicClient!.waitForTransactionReceipt({
        hash: phase1Hash,
        timeout: 120_000,
      });

      // finalizeClosePosition / finalizeClosePlainPayout are onlyFinalizer / onlyOwner — backend keeper only.
      setCloseStep('keeper');
      setStatus('awaiting_finalizer');
      await waitForCloseSettledByKeeper(publicClient!, contracts, positionKey, payout, {
        fromBlock: receipt.blockNumber,
      });

      useStore.getState().setPositions(
        useStore.getState().positions.filter((p) => p.positionKey !== positionKey),
      );
      if (walletAddress) {
        removePositionKey(chainId, walletAddress as `0x${string}`, positionKey);
      }
      setCloseStep('done');
      setStatus('confirmed');
    } catch (err: unknown) {
      setError(formatWalletError(err));
      setStatus('error');
      setCloseStep('idle');
    }
  }, [write, publicClient, walletAddress, chainId, contracts, indexToken]);

  const isClosing =
    closeStep === 'request' ||
    closeStep === 'keeper';

  return { execute, status, closeStep, isClosing, error, reset };
}

/** On-chain phase-1 open still awaiting finalize (all networks). */
export function usePendingOpenRequest() {
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const { data, refetch, isLoading, isFetching } = useReadContract({
    address: contracts.router,
    abi: FHE_ROUTER_READ_ABI,
    functionName: 'pendingOpenRequests',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 12_000,
    },
  });

  const tuple = data as readonly [bigint, bigint, bigint, boolean] | undefined;
  const exists = tuple?.[3] ?? false;

  return { exists, isLoading: isLoading || isFetching, refetch };
}

/** Clear a stuck two-phase market open (router + vault liquidity check). */
export function useCancelPendingOpen() {
  const [status, setStatus] = useState<TradeStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const publicClient = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const indexToken = getIndexToken(chainId);

  const execute = useCallback(
    async (onSuccess?: () => void | Promise<void>) => {
      setError(null);
      try {
        setStatus('submitting');
        const fees = await publicClient!.estimateFeesPerGas();
        await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'cancelPendingOpenPosition',
          args: [indexToken],
          gas: 300_000n,
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
        setStatus('confirmed');
        await onSuccess?.();
        setTimeout(() => setStatus('idle'), 2500);
      } catch (err: unknown) {
        setError(formatWalletError(err));
        setStatus('error');
      }
    },
    [write, publicClient, contracts.router, indexToken],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { execute, status, error, reset };
}

/** Cancel a pending limit/stop order (no fee required). */
export function useCancelOrder() {
  const [status, setStatus] = useState<TradeStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const publicClient               = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const execute = useCallback(async (orderId: number) => {
    setError(null);
    try {
      setStatus('submitting');
      const fees = await publicClient!.estimateFeesPerGas();
      await write({
        address: contracts.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'cancelOrder',
        args: [BigInt(orderId)],
        gas: 200_000n,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      setStatus('confirmed');
    } catch (err: unknown) {
      setError(formatWalletError(err));
      setStatus('error');
    }
  }, [write, publicClient, contracts.router]);

  return { execute, status, error };
}

const ORACLE_STALE_SECONDS = 300;

export function useTradePrecheck(
  collateralUsd: number,
  leverage: number,
  collateralMode: CollateralMode = 'encrypted',
  orderType: 'market' | 'limit' | 'stop' = 'market',
) {
  const { exists: hasPendingOpen } = usePendingOpenRequest();
  const underlying = useUnderlyingTokenMeta();
  const { balance: underlyingBalance } = useWrapUnderlyingBalance();
  const { allowance } = useWrapUnderlyingAllowance();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const indexToken = getIndexToken(chainId);

  const { data: priceData } = useReadContract({
    address: contracts.priceOracle,
    abi: PRICE_ORACLE_ABI,
    functionName: 'getPriceData',
    args: [indexToken],
    query: { refetchInterval: 10_000 },
  });

  const nowSec = Math.floor(Date.now() / 1000);
  const [pricePlain, lastUpdated] = (priceData as [bigint, bigint] | undefined) ?? [0n, 0n];
  const priceAge       = lastUpdated > 0n ? nowSec - Number(lastUpdated) : null;
  const oracleNeverSet = pricePlain === 0n;
  const oracleStale    = !oracleNeverSet && priceAge != null && priceAge > ORACLE_STALE_SECONDS;
  const oracleOk       = !oracleNeverSet && !oracleStale;

  const requiredLiq = collateralUsd * leverage;

  const collateralWei =
    collateralUsd > 0 ? parseUnits(collateralUsd.toString(), TOKEN_DECIMALS) : 0n;

  const warnings: string[] = [];
  if (oracleNeverSet) {
    warnings.push('Oracle price not set.');
  } else if (oracleStale) {
    warnings.push(`Oracle price is stale (${priceAge}s old, max ${ORACLE_STALE_SECONDS}s).`);
  }

  if (hasPendingOpen && orderType === 'market') {
    warnings.push(
      'Incomplete market open in progress — cancel it below or wait for phase 2 to finish before opening again.',
    );
  }

    if (collateralMode === 'wrap') {
    if (orderType !== 'market') {
      warnings.push('Wrap-from-underlying only supports market orders.');
    }
    if (!underlying.wrapConfigured) {
      warnings.push(
        'Wrap not available on this chain — set vault.setUnderlyingToken on deploy, or use encrypted collateral.',
      );
    } else if (collateralUsd > 0) {
      if (collateralWei > UINT64_MAX) {
        warnings.push('Collateral too large for uint64 wrap path.');
      }
      if (underlyingBalance !== undefined && underlyingBalance < collateralWei) {
        warnings.push(
          `Insufficient ${underlying.symbol} balance (need ${formatUnits(collateralWei, underlying.decimals)}).`,
        );
      }
      if (allowance !== undefined && allowance < collateralWei) {
        warnings.push(`Approve ${underlying.symbol} for the router (included in submit flow).`);
      }
    }
  }

  const wrapOk =
    collateralMode !== 'wrap' ||
    (underlying.wrapConfigured &&
      orderType === 'market' &&
      collateralWei <= UINT64_MAX &&
      (underlyingBalance === undefined || underlyingBalance >= collateralWei));

  const marketBlockedByPending = hasPendingOpen && orderType === 'market';

  return {
    oracleOk,
    oracleNeverSet,
    oracleStale,
    priceAge,
    liquidityOk: true,
    availLiq: null,
    requiredLiq,
    underlyingConfigured: underlying.configured,
    underlyingSymbol: underlying.symbol,
    hasPendingOpen,
    warnings,
    ready: oracleOk && wrapOk && !marketBlockedByPending,
  };
}

import { useState, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import {
  useWriteContract,
  useReadContract,
  usePublicClient,
  useAccount,
  useChainId,
} from 'wagmi';
import { formatUnits, parseUnits, parseAbiItem, decodeEventLog } from 'viem';
import { Encryptable } from '@cofhe/sdk';
import {
  getContracts, getFromBlock, getIndexToken, TOKEN_DECIMALS,
  FHE_ROUTER_ABI, FHE_ROUTER_READ_ABI, FHE_TOKEN_ABI, FHE_VAULT_ABI,
  PRICE_ORACLE_ABI,
  POSITION_MANAGER_ABI,
} from '@/lib/contracts';
import { assertUint64Amount, UINT64_MAX, type CollateralMode } from '@/lib/composability';
import { waitForPlainPayoutSettled, type ClosePayoutMode } from '@/lib/closePayout';
import { resolveOpenLiquidityProof } from '@/lib/tradeLiquidity';
import { decryptForTxWithRetry, encryptInputsOnChain, isCofheReady, normaliseEnc, toHexSig } from '@/hooks/useCofhe';
import { useApproveUnderlying } from '@/hooks/useApproveUnderlying';
import { formatWalletError } from '@/lib/walletErrors';
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
  | 'awaiting_decrypt'    // waiting for CoFHE TN decrypt during close finalization
  | 'confirmed'
  | 'error';

export type { CollateralMode };

/** User-visible steps for the two-phase close (request → TN decrypt → finalize). */
export type CloseStep = 'idle' | 'request' | 'decrypt' | 'finalize' | 'keeper' | 'done';

export const CLOSE_STEP_LABELS: Record<Exclude<CloseStep, 'idle'>, string> = {
  request: 'Step 1/3: Requesting close on-chain…',
  decrypt: 'Step 2/3: Decrypting settlement (CoFHE)…',
  finalize: 'Step 3/3: Publishing settlement on-chain…',
  keeper: 'Step 3/3: Waiting for plain payout settlement…',
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
        await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'finalizeOpenPositionPlain',
          args: [indexToken, plainCollateral, encL, encI, hasLiqPlain, hasLiqSig],
          gas: 3_000_000n,
          maxFeePerGas: phase2Fees.maxFeePerGas,
          maxPriorityFeePerGas: phase2Fees.maxPriorityFeePerGas,
        });
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
        await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'finalizeOpenPosition',
          args: [indexToken, encC, encL, encI, hasLiqPlain, hasLiqSig],
          gas: 3_000_000n,
          maxFeePerGas: phase2Fees.maxFeePerGas,
          maxPriorityFeePerGas: phase2Fees.maxPriorityFeePerGas,
        });
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
  const fromBlockDefault = getFromBlock(chainId);

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

      // Plain payout step 3 is done by router owner / backend keeper — no wallet decrypt required.
      if (payout === 'encrypted' && !isCofheReady()) {
        throw new Error('CoFHE client not ready — wallet still connecting, please try again in a moment');
      }

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

      const routerOwner = await publicClient!.readContract({
        address: contracts.router,
        abi: FHE_ROUTER_READ_ABI,
        functionName: 'owner',
      }) as `0x${string}`;
      const canFinalizePlain =
        payout === 'plain' &&
        walletAddress.toLowerCase() === routerOwner.toLowerCase();

      // Plain close for normal wallets: keeper decrypts + finalizeClosePlainPayout (router owner only).
      if (payout === 'plain' && !canFinalizePlain) {
        setCloseStep('keeper');
        setStatus('awaiting_decrypt');
        await waitForPlainPayoutSettled(publicClient!, contracts, positionKey, {
          fromBlock: receipt.blockNumber,
        });
        useStore.getState().setPositions(
          useStore.getState().positions.filter((p) => p.positionKey !== positionKey),
        );
        setCloseStep('done');
        setStatus('confirmed');
        return;
      }

      setCloseStep('decrypt');
      setStatus('awaiting_decrypt');

      // Extract CloseRequested handles from receipt logs (PositionManager emits it).
      const pmAddr = contracts.positionManager.toLowerCase();
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
      const openedLogs = await publicClient!.getLogs({
        address: contracts.positionManager as `0x${string}`,
        event: parseAbiItem(
          'event PositionOpened(bytes32 indexed positionKey, address indexed trader, bytes32 sizeHandle, bytes32 collateralHandle, bytes32 isLongHandle)'
        ),
        args: { positionKey },
        fromBlock: fromBlockDefault,
        toBlock: receipt.blockNumber,
      });

      const collateralHandle = openedLogs[openedLogs.length - 1]?.args?.collateralHandle as `0x${string}` | undefined;
      if (!collateralHandle) {
        throw new Error('PositionOpened(collateralHandle) not found for this positionKey');
      }

      // Off-chain decrypt with CoFHE TN (signatures used for publishDecryptResult on-chain).
      const [finalAmount, size, collateral] = await Promise.all([
        decryptForTxWithRetry(BigInt(finalAmountHandle), { chainId, label: 'close.finalAmount', retries: 20, delayMs: 5000, tryWithoutPermitFallback: true }),
        decryptForTxWithRetry(BigInt(sizeHandle), { chainId, label: 'close.size', retries: 20, delayMs: 5000, tryWithoutPermitFallback: true }),
        decryptForTxWithRetry(BigInt(collateralHandle), { chainId, label: 'close.collateral', retries: 20, delayMs: 5000, tryWithoutPermitFallback: true }),
      ]);

      const isLongPlain = options?.isLong ?? false;
      const finalizeArgs = [
        positionKey,
        finalAmount.decryptedValue,
        toHexSig(finalAmount.signature),
        size.decryptedValue,
        toHexSig(size.signature),
        collateral.decryptedValue,
        toHexSig(collateral.signature),
        isLongPlain,
      ] as const;

      setCloseStep('finalize');
      setStatus('submitting');
      const fees2 = await publicClient!.estimateFeesPerGas();

      if (payout === 'plain') {
        await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'finalizeClosePlainPayout',
          args: [...finalizeArgs],
          gas: 3_000_000n,
          maxFeePerGas: fees2.maxFeePerGas,
          maxPriorityFeePerGas: fees2.maxPriorityFeePerGas,
        });
      } else {
        await write({
          address: contracts.positionManager,
          abi: POSITION_MANAGER_ABI,
          functionName: 'finalizeClosePosition',
          args: [...finalizeArgs],
          gas: 3_000_000n,
          maxFeePerGas: fees2.maxFeePerGas,
          maxPriorityFeePerGas: fees2.maxPriorityFeePerGas,
        });
      }

      useStore.getState().setPositions(
        useStore.getState().positions.filter((p) => p.positionKey !== positionKey),
      );
      setCloseStep('done');
      setStatus('confirmed');
    } catch (err: unknown) {
      setError(formatWalletError(err));
      setStatus('error');
      setCloseStep('idle');
    }
  }, [write, publicClient, walletAddress, contracts, indexToken, fromBlockDefault]);

  const isClosing =
    closeStep === 'request' ||
    closeStep === 'decrypt' ||
    closeStep === 'finalize' ||
    closeStep === 'keeper';

  return { execute, status, closeStep, isClosing, error, reset };
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
    warnings,
    ready: oracleOk && wrapOk,
  };
}

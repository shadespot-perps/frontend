import { useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { CONTRACTS, POSITION_MANAGER_ABI, TOKEN_DECIMALS } from '@/lib/contracts';
import { decryptForTxWithRetry, isCofheReady } from '@/hooks/useCofhe';
import { useStore, type PositionStatus } from '@/store/useStore';
import { toast } from '@/components/ui/sonner';

const ORACLE_PRICE_DECIMALS = 1e8; // matches `useMarketData()` priceRaw / 1e8
const LIQUIDATION_THRESHOLD = 0.8; // PositionManager.LIQUIDATION_THRESHOLD (80) / 100

function bigIntToNumber(value: bigint, decimals: number): number {
  const divisor = 10n ** BigInt(decimals);
  const intPart = value / divisor;
  const fracPart = value % divisor;
  return Number(intPart) + Number(fracPart) / Number(divisor);
}

export function useDecryptPosition() {
  const { address: walletAddress } = useAccount();
  const publicClient = usePublicClient();

  const positions = useStore(s => s.positions);
  const markPrice = useStore(s => s.market.markPrice);
  const setPositionStatus = useStore(s => s.setPositionStatus);
  const updatePosition = useStore(s => s.updatePosition);

  return useCallback(async (id: string) => {
    const pos = positions.find(p => p.id === id);
    if (!pos) return;
    if (!walletAddress) {
      toast.error('Wallet not connected');
      console.error('[decryptPosition] wallet not connected');
      return;
    }
    if (!publicClient) {
      toast.error('RPC client not ready');
      console.error('[decryptPosition] public client not ready');
      return;
    }
    if (!isCofheReady()) {
      toast.error('CoFHE not ready (wallet still connecting)');
      console.error('[decryptPosition] CoFHE client not ready');
      return;
    }

    setPositionStatus(id, 'decrypting' as PositionStatus);

    try {
      const pmPosRaw = await publicClient.readContract({
        address: CONTRACTS.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'getMyPosition',
        args: [pos.positionKey],
        // `getMyPosition()` checks `positions[key].owner == msg.sender`.
        // For `eth_call`, we must provide the caller address so `msg.sender` matches the connected wallet.
        account: walletAddress as `0x${string}`,
      });

      const pmPos = (() => {
        const pmAny = pmPosRaw as unknown as Record<number, unknown> | unknown[];

        // viem tuple outputs often come back as an array-like object with numeric indices.
        // We decode by indices to avoid relying on named keys.
        const hasIndex0 = (v: unknown): v is Record<number, unknown> =>
          typeof v === 'object' && v !== null && 0 in (v as Record<number, unknown>);

        if (pmAny && (Array.isArray(pmPosRaw) || hasIndex0(pmAny))) {
          const owner = (pmAny as Record<number, unknown>)[0] as `0x${string}`;
          const indexToken = (pmAny as Record<number, unknown>)[1] as `0x${string}`;
          const size = (pmAny as Record<number, unknown>)[2] as `0x${string}` | bigint;
          const collateral = (pmAny as Record<number, unknown>)[3] as `0x${string}` | bigint;
          const entryPrice = (pmAny as Record<number, unknown>)[4] as `0x${string}` | bigint;
          const entryFundingRateBiased = (pmAny as Record<number, unknown>)[5] as `0x${string}` | bigint;
          const eLeverage = (pmAny as Record<number, unknown>)[6] as `0x${string}` | bigint;
          const isLong = (pmAny as Record<number, unknown>)[7] as `0x${string}` | bigint;
          const exists = (pmAny as Record<number, unknown>)[8] as boolean;
          const leverage = (pmAny as Record<number, unknown>)[9] as bigint;
          return { owner, indexToken, size, collateral, entryPrice, entryFundingRateBiased, eLeverage, isLong, exists, leverage };
        }

        // Fallback: some clients may return a named object.
        return pmPosRaw as unknown as {
          owner: `0x${string}`;
          indexToken: `0x${string}`;
          size: `0x${string}` | bigint;
          collateral: `0x${string}` | bigint;
          entryPrice: `0x${string}` | bigint;
          entryFundingRateBiased: `0x${string}` | bigint;
          eLeverage: `0x${string}` | bigint;
          isLong: `0x${string}` | bigint;
          exists: boolean;
          leverage: bigint;
        };
      })();

      if (!pmPos.exists) {
        // Some RPC/providers/ABI decoding paths may give `exists=false` even when handles are still readable.
        // We only treat it as "not decryptable" when all encrypted handles are zero.
        toast.warning('Position exists=false on-chain; attempting decrypt anyway');
      }

      const sizeHandle = pmPos.size as `0x${string}` | bigint;
      const collateralHandle = pmPos.collateral as `0x${string}` | bigint;
      const entryPriceHandle = pmPos.entryPrice as `0x${string}` | bigint;
      const eLeverageHandle = pmPos.eLeverage as `0x${string}` | bigint;
      const isLongHandle = pmPos.isLong as `0x${string}` | bigint;

      const missing: string[] = [];
      if (typeof sizeHandle === 'undefined') missing.push('size');
      if (typeof collateralHandle === 'undefined') missing.push('collateral');
      if (typeof entryPriceHandle === 'undefined') missing.push('entryPrice');
      if (typeof eLeverageHandle === 'undefined') missing.push('eLeverage');
      if (typeof isLongHandle === 'undefined') missing.push('isLong');
      if (missing.length > 0) {
        toast.error(`Decrypt failed: missing handles: ${missing.join(', ')}`);
        updatePosition(id, { status: 'encrypted' });
        return;
      }

      const ZERO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';
      const isZero = (h: `0x${string}` | bigint) => {
        if (typeof h === 'bigint') return h === 0n;
        if (typeof h === 'string') return h.toLowerCase() === ZERO_HANDLE;
        return false;
      };

      if (isZero(sizeHandle) && isZero(collateralHandle) && isZero(entryPriceHandle) && isZero(eLeverageHandle) && isZero(isLongHandle)) {
        toast.error('Encrypted position handles are empty on-chain');
        updatePosition(id, { status: 'encrypted' });
        return;
      }

      // CoFHE decrypt-for-tx can be nonce-sensitive: keep it sequential.
      const sizeRes = await decryptForTxWithRetry(BigInt(sizeHandle), { label: 'pos.size' });
      const collateralRes = await decryptForTxWithRetry(BigInt(collateralHandle), { label: 'pos.collateral' });
      const entryPriceRes = await decryptForTxWithRetry(BigInt(entryPriceHandle), { label: 'pos.entryPrice' });
      const eLeverageRes = await decryptForTxWithRetry(BigInt(eLeverageHandle), { label: 'pos.eLeverage' });
      const isLongRes = await decryptForTxWithRetry(BigInt(isLongHandle), { label: 'pos.isLong' });

      const size = bigIntToNumber(sizeRes.decryptedValue, TOKEN_DECIMALS);
      const collateral = bigIntToNumber(collateralRes.decryptedValue, TOKEN_DECIMALS);
      const entryPrice = Number(entryPriceRes.decryptedValue) / ORACLE_PRICE_DECIMALS;
      const leverage = Number(eLeverageRes.decryptedValue);
      const isLong = isLongRes.decryptedValue !== 0n;

      const signedDiff = isLong ? (markPrice - entryPrice) : (entryPrice - markPrice);
      const pnl = entryPrice > 0 ? (signedDiff / entryPrice) * size : 0;
      const pnlPercent = collateral > 0 ? (pnl / collateral) * 100 : 0;

      const liquidationPrice = leverage > 0 && entryPrice > 0
        ? entryPrice * (isLong ? (1 - LIQUIDATION_THRESHOLD / leverage) : (1 + LIQUIDATION_THRESHOLD / leverage))
        : 0;

      updatePosition(id, {
        status: 'decrypted',
        side: isLong ? 'long' : 'short',
        leverage,
        size,
        collateral,
        entryPrice,
        markPrice,
        pnl,
        pnlPercent,
        liquidationPrice,
      });
    } catch (err) {
      console.error('[decryptPosition] failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Decrypt failed: ${msg}`);
      // Let user retry without requiring a refresh.
      updatePosition(id, { status: 'encrypted' });
    }
  }, [positions, publicClient, walletAddress, markPrice, setPositionStatus, updatePosition]);
}


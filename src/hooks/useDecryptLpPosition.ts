import { useCallback, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { CONTRACTS, FHE_VAULT_ABI } from '@/lib/contracts';
import { decryptForTxWithRetry } from '@/hooks/useCofhe';
import type { PositionStatus } from '@/store/useStore';
import { toast } from '@/components/ui/sonner';

type LpPositionState = {
  status: PositionStatus;
  shares: number | null;
  totalShares: number | null;
  poolSharePct: number | null;
  pendingWithdrawShares: bigint | null;
};

function safePct(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function useDecryptLpPosition() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [state, setState] = useState<LpPositionState>({
    status: 'encrypted',
    shares: null,
    totalShares: null,
    poolSharePct: null,
    pendingWithdrawShares: null,
  });

  const canDecrypt = !!address && !!publicClient;

  const decrypt = useCallback(async () => {
    if (!address || !publicClient) return;
    if (state.status === 'decrypting') return;

    setState((s) => ({ ...s, status: 'decrypting' }));

    try {
      const [lpBalHandle, totalSupplyHandle, pendingWithdraw] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.vault as `0x${string}`,
          abi: FHE_VAULT_ABI,
          functionName: 'lpBalance',
          args: [address as `0x${string}`],
        }),
        publicClient.readContract({
          address: CONTRACTS.vault as `0x${string}`,
          abi: FHE_VAULT_ABI,
          functionName: 'encryptedTotalSupply',
          args: [],
        }),
        publicClient.readContract({
          address: CONTRACTS.vault as `0x${string}`,
          abi: FHE_VAULT_ABI,
          functionName: 'pendingWithdraw',
          args: [address as `0x${string}`],
        }),
      ]);

      const pendingAny = pendingWithdraw as unknown as { shares?: bigint } | readonly unknown[];
      const pendingShares =
        Array.isArray(pendingAny) ? (pendingAny[3] as bigint | undefined) : pendingAny.shares;

      const lpHandleBig = BigInt(lpBalHandle as unknown as `0x${string}`);
      const tsHandleBig = BigInt(totalSupplyHandle as unknown as `0x${string}`);

      // Decrypt sequentially: if TN rejects (403), avoid spamming with parallel requests.
      const lpDec = await decryptForTxWithRetry(lpHandleBig, {
        label: 'lp.shares',
        retries: 12,
        delayMs: 4000,
        tryWithoutPermitFallback: true,
      });
      const tsDec = await decryptForTxWithRetry(tsHandleBig, {
        label: 'lp.totalShares',
        retries: 12,
        delayMs: 4000,
        tryWithoutPermitFallback: true,
      });

      const sharesNum = Number(lpDec.decryptedValue);
      const totalSharesNum = Number(tsDec.decryptedValue);

      setState({
        status: 'decrypted',
        shares: Number.isFinite(sharesNum) ? sharesNum : null,
        totalShares: Number.isFinite(totalSharesNum) ? totalSharesNum : null,
        poolSharePct: safePct(sharesNum, totalSharesNum),
        pendingWithdrawShares: pendingShares ?? null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'LP decrypt failed';
      toast.error(msg);
      setState((s) => ({ ...s, status: 'encrypted' }));
    }
  }, [address, publicClient, state.status]);

  const display = useMemo(() => {
    return {
      sharesLabel:
        state.status === 'decrypted' && state.shares != null
          ? state.shares.toLocaleString(undefined, { maximumFractionDigits: 0 })
          : null,
      poolShareLabel:
        state.status === 'decrypted' && state.poolSharePct != null
          ? `${state.poolSharePct.toFixed(4)}%`
          : null,
      pendingWithdrawLabel:
        state.pendingWithdrawShares != null && state.pendingWithdrawShares > 0n
          ? state.pendingWithdrawShares.toString()
          : null,
    };
  }, [state]);

  return { ...state, ...display, decrypt, canDecrypt };
}


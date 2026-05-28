import { useCallback, useMemo, useState } from 'react';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { getContracts, FHE_VAULT_ABI } from '@/lib/contracts';
import { decryptForTxWithRetry } from '@/hooks/useCofhe';
import type { PositionStatus } from '@/store/useStore';
import { toast } from '@/components/ui/sonner';
import { formatUnits } from 'viem';
import { TOKEN_DECIMALS } from '@/lib/contracts';

type LpPositionState = {
  status: PositionStatus;
  shares: bigint | null;
  totalShares: bigint | null;
  poolShareBps: bigint | null; // 1 bps = 0.01%
  pendingWithdrawShares: bigint | null;
};

function safeBps(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n) return null;
  // (numerator / denominator) * 100% in basis points (1% = 100 bps)
  // bps = numerator * 10000 / denominator
  return (numerator * 10_000n) / denominator;
}

export function useDecryptLpPosition() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const [state, setState] = useState<LpPositionState>({
    status: 'encrypted',
    shares: null,
    totalShares: null,
    poolShareBps: null,
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
          address: contracts.vault as `0x${string}`,
          abi: FHE_VAULT_ABI,
          functionName: 'lpBalance',
          args: [address as `0x${string}`],
        }),
        publicClient.readContract({
          address: contracts.vault as `0x${string}`,
          abi: FHE_VAULT_ABI,
          functionName: 'encryptedTotalSupply',
          args: [],
        }),
        publicClient.readContract({
          address: contracts.vault as `0x${string}`,
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

      // User LP balance: FHE.allow(lpBalance[user], user) on deposit/withdraw.
      const lpDec = await decryptForTxWithRetry(lpHandleBig, {
        label: 'lp.shares',
        chainId,
        retries: 12,
        delayMs: 4000,
        tryWithoutPermitFallback: true,
      });
      const shares = lpDec.decryptedValue;

      // Total supply needs FHE.allowPublic(encryptedTotalSupply) on vault (see FHEVault._syncEncryptedTotalSupplyAllows).
      let totalShares: bigint | null = null;
      try {
        const tsDec = await decryptForTxWithRetry(tsHandleBig, {
          label: 'lp.totalShares',
          chainId,
          retries: 8,
          delayMs: 4000,
          tryWithoutPermitFallback: true,
        });
        totalShares = tsDec.decryptedValue;
      } catch (tsErr: unknown) {
        const tsMsg = tsErr instanceof Error ? tsErr.message : String(tsErr ?? '');
        const is403 = tsMsg.includes('403');
        if (is403) {
          toast.message(
            'Your LP shares were decrypted. Pool share % needs a vault with allowPublic(totalSupply) — redeploy or make another deposit after upgrade.',
          );
        } else {
          throw tsErr;
        }
      }

      setState({
        status: 'decrypted',
        shares,
        totalShares,
        poolShareBps: totalShares != null ? safeBps(shares, totalShares) : null,
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
          ? Number(formatUnits(state.shares, TOKEN_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 6 })
          : null,
      poolShareLabel:
        state.status === 'decrypted' && state.poolShareBps != null
          ? `${(Number(state.poolShareBps) / 100).toFixed(4)}%`
          : null,
      pendingWithdrawLabel:
        state.pendingWithdrawShares != null && state.pendingWithdrawShares > 0n
          ? state.pendingWithdrawShares.toString()
          : null,
    };
  }, [state]);

  return { ...state, ...display, decrypt, canDecrypt };
}


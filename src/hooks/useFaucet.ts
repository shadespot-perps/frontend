import { useCallback, useEffect, useState } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
} from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import { getContracts, DEV_PLAIN_ERC20_ABI, MOCK_FHE_TOKEN_ABI, SUPPORTED_CHAIN_IDS } from '@/lib/contracts';
import { UINT64_MAX } from '@/lib/composability';

export type FaucetMintStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

export { useUnderlyingTokenAddress, useUnderlyingTokenMeta } from '@/hooks/useUnderlyingToken';

export function useFaucetTokenMeta(address: `0x${string}` | null, kind: 'fhe' | 'plain') {
  const abi = kind === 'fhe' ? MOCK_FHE_TOKEN_ABI : DEV_PLAIN_ERC20_ABI;
  const enabled = !!address;

  const { data: name } = useReadContract({
    address: address ?? undefined,
    abi,
    functionName: 'name',
    query: { enabled },
  });
  const { data: symbol } = useReadContract({
    address: address ?? undefined,
    abi,
    functionName: 'symbol',
    query: { enabled },
  });
  const { data: decimals } = useReadContract({
    address: address ?? undefined,
    abi,
    functionName: 'decimals',
    query: { enabled },
  });

  return {
    name: (name as string) ?? (kind === 'fhe' ? 'Encrypted USDC' : 'Plain token'),
    symbol: (symbol as string) ?? (kind === 'fhe' ? 'eUSDC' : 'USDC'),
    decimals: typeof decimals === 'number' ? decimals : Number(decimals ?? 6),
  };
}

export function usePlainBalance(token: `0x${string}` | null) {
  const { address } = useAccount();
  const { data, refetch } = useReadContract({
    address: token ?? undefined,
    abi: DEV_PLAIN_ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!token && !!address },
  });

  return { balance: data as bigint | undefined, refetch };
}

export function useFaucetMint(
  kind: 'fhe' | 'plain',
  plainTokenAddress?: `0x${string}` | null,
) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const [status, setStatus] = useState<FaucetMintStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null);

  const tokenAddress =
    kind === 'fhe' ? (contracts.fheToken as `0x${string}`) : (plainTokenAddress ?? null);

  const { decimals } = useFaucetTokenMeta(tokenAddress, kind);
  const { refetch: refetchBalance } = usePlainBalance(
    kind === 'plain' ? tokenAddress : null,
  );

  const { writeContractAsync, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: lastTxHash ?? undefined,
  });

  const mint = useCallback(
    async (humanAmount: string) => {
      setError(null);
      setLastTxHash(null);

      if (!address) {
        setError('Connect your wallet first');
        setStatus('error');
        return;
      }
      if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
        setError(`Unsupported network (chain ${chainId}). Switch to one of: ${SUPPORTED_CHAIN_IDS.join(', ')}`);
        setStatus('error');
        return;
      }
      if (!tokenAddress) {
        setError(
          kind === 'plain'
            ? 'No underlying token configured on vault/router. Set DEV_UNDERLYING_TOKEN in contracts.ts or call vault.setUnderlyingToken.'
            : 'FHE token address missing',
        );
        setStatus('error');
        return;
      }

      const trimmed = humanAmount.trim();
      if (!trimmed || Number(trimmed) <= 0) {
        setError('Enter a positive amount');
        setStatus('error');
        return;
      }

      let amountWei: bigint;
      try {
        amountWei = parseUnits(trimmed, decimals);
      } catch {
        setError('Invalid amount');
        setStatus('error');
        return;
      }

      setStatus('pending');

      try {
        let hash: `0x${string}`;
        if (kind === 'fhe') {
          if (amountWei > UINT64_MAX) {
            throw new Error(`Amount too large for FHE mint (max ${formatUnits(UINT64_MAX, decimals)} ${decimals} dp)`);
          }
          hash = await writeContractAsync({
            address: tokenAddress,
            abi: MOCK_FHE_TOKEN_ABI,
            functionName: 'mint',
            args: [address, amountWei],
          });
        } else {
          hash = await writeContractAsync({
            address: tokenAddress,
            abi: DEV_PLAIN_ERC20_ABI,
            functionName: 'mint',
            args: [address, amountWei],
          });
        }
        setLastTxHash(hash);
        setStatus('confirming');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg.includes('mint') ? msg : `Mint failed: ${msg}`);
        setStatus('error');
      }
    },
    [address, chainId, decimals, kind, tokenAddress, writeContractAsync],
  );

  useEffect(() => {
    if (isSuccess && status === 'confirming') {
      setStatus('success');
      if (kind === 'plain') void refetchBalance();
    }
  }, [isSuccess, status, kind, refetchBalance]);

  const effectiveStatus: FaucetMintStatus = isPending
    ? 'pending'
    : isConfirming
      ? 'confirming'
      : status;

  return {
    mint,
    status: effectiveStatus,
    error,
    lastTxHash,
    tokenAddress,
    decimals,
    reset: () => {
      setStatus('idle');
      setError(null);
      setLastTxHash(null);
    },
  };
}

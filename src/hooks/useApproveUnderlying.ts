import { useCallback, useState } from 'react';
import { useAccount, useChainId, useWriteContract, usePublicClient } from 'wagmi';
import { maxUint256 } from 'viem';
import { getContracts, DEV_PLAIN_ERC20_ABI } from '@/lib/contracts';
import { formatWalletError } from '@/lib/walletErrors';
import { useOnChainUnderlyingAddress, useWrapUnderlyingAllowance } from '@/hooks/useUnderlyingToken';

export type ApproveStatus = 'idle' | 'pending' | 'success' | 'error';

export function useApproveUnderlying() {
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const { address: token, configured } = useOnChainUnderlyingAddress();
  const { allowance, refetch: refetchAllowance } = useWrapUnderlyingAllowance();
  const [status, setStatus] = useState<ApproveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const approve = useCallback(
    async (requiredAmount: bigint) => {
      if (!address || !token) {
        throw new Error(
          'Wrap collateral is not enabled on this network (vault/router underlyingToken unset). Use encrypted collateral or set underlying on deploy.',
        );
      }
      if (allowance !== undefined && allowance >= requiredAmount) {
        return;
      }

      setError(null);
      setStatus('pending');
      try {
        const fees = await publicClient!.estimateFeesPerGas();
        await writeContractAsync({
          address: token,
          abi: DEV_PLAIN_ERC20_ABI,
          functionName: 'approve',
          args: [contracts.router, maxUint256],
          gas: 100_000n,
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
        await refetchAllowance();
        setStatus('success');
      } catch (e) {
        const msg = formatWalletError(e);
        setError(msg);
        setStatus('error');
        throw new Error(msg);
      }
    },
    [address, allowance, publicClient, refetchAllowance, token, writeContractAsync, contracts.router],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return {
    approve,
    allowance,
    configured,
    token,
    status,
    error,
    reset,
    hasEnoughAllowance: (amount: bigint) =>
      allowance !== undefined && allowance >= amount,
  };
}

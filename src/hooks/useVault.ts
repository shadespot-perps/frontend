import { useState, useCallback } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from 'wagmi';
import { parseUnits, parseAbiItem, type WriteContractParameters } from 'viem';
import { Encryptable } from '@cofhe/sdk';
import {
  CONTRACTS, TOKEN_DECIMALS,
  FHE_ROUTER_ABI, FHE_TOKEN_ABI, VAULT_EVENTS_ABI,
} from '@/lib/contracts';
import { decryptForTxWithRetry, encryptInputsOnChain, isCofheReady, normaliseEnc, toHexSig } from '@/hooks/useCofhe';

// Manual gas override removed to let Viem natively negotiate Arbitrum L2 fees

// FHEVault totalLiquidity is an encrypted euint64 — TVL and utilization
// are never readable as plaintext. Always return encrypted.
export function useVaultStats() {
  return { tvl: null, utilization: null, isEncrypted: true };
}

// FHE token balances are encrypted — cannot read via balanceOf.
export function useTokenBalance() {
  return { balance: null, isEncrypted: true, refetch: () => {} };
}

export type VaultTxStatus =
  | 'idle'
  | 'setting_operator'
  | 'encrypting'
  | 'submitting'
  | 'submitting_check'   // phase-1 submitWithdrawCheck tx in wallet
  | 'awaiting_decrypt'   // waiting for CoFHE TN to decrypt both handles
  | 'confirmed'
  | 'error';

export function useAddLiquidity() {
  const [status, setStatus] = useState<VaultTxStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { address } = useAccount();

  const { data: isOperatorRaw, refetch: refetchOperator } = useReadContract({
    address: CONTRACTS.fheToken,
    abi: FHE_TOKEN_ABI,
    functionName: 'isOperator',
    args: [address!, CONTRACTS.router],
    query: { enabled: !!address },
  });

  const publicClient               = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();

  const execute = useCallback(async (amountStr: string) => {
    if (!address) return;
    setError(null);
    try {
      if (!isCofheReady()) throw new Error('CoFHE client not ready — wallet still connecting, please try again in a moment');
      const amountWei = parseUnits(amountStr, TOKEN_DECIMALS);
      if (!isOperatorRaw) {
        setStatus('setting_operator');
        const oneYear = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
        await write({
          address: CONTRACTS.fheToken,
          abi: FHE_TOKEN_ABI,
          functionName: 'setOperator',
          args: [CONTRACTS.router, oneYear],
        });
        await refetchOperator();
      }

      setStatus('encrypting');
      const [encAmount] = await encryptInputsOnChain([Encryptable.uint64(amountWei)]);

      setStatus('submitting');
      const fees = await publicClient!.estimateFeesPerGas();
      await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'addLiquidity',
        args: [normaliseEnc(encAmount)],
        gas: 1_000_000n,             // CoFHE precompiles break simulation — fixed gas limit; prev 500k ran OOG
        maxFeePerGas:         fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      setStatus('confirmed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      const isRejection = msg.toLowerCase().includes('user denied') || msg.toLowerCase().includes('user rejected');
      setError(
        isRejection
          ? 'Transaction rejected. The operator approval is required once to let the pool handle your encrypted tokens — please approve it in MetaMask to continue.'
          : msg
      );
      setStatus('error');
    }
  }, [address, isOperatorRaw, write, refetchOperator, publicClient]);

  const reset = useCallback(() => { setStatus('idle'); setError(null); }, []);

  return { execute, status, error, reset, isOperatorSet: !!isOperatorRaw };
}

export function useRemoveLiquidity() {
  const [status, setStatus] = useState<VaultTxStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { address } = useAccount();
  const publicClient               = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();

  const execute = useCallback(async (sharesStr: string) => {
    if (!address) return;
    setError(null);
    try {
      const shares = parseUnits(sharesStr, TOKEN_DECIMALS);

      // Phase 1: submit withdraw check on-chain
      setStatus('submitting_check');
      const phase1Hash = await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'submitWithdrawCheck',
        args: [shares],
      });

      setStatus('awaiting_decrypt');

      // Wait for phase-1 receipt, then read handles from FHEVault event.
      const receipt = await publicClient!.waitForTransactionReceipt({
        hash: phase1Hash,
        timeout: 120_000,
      });

      const withdrawLogs = await publicClient!.getLogs({
        address: CONTRACTS.vault as `0x${string}`,
        event: parseAbiItem(
          'event WithdrawCheckSubmitted(address indexed lp, bytes32 hasBalHandle, bytes32 hasLiqHandle, uint256 shares)'
        ),
        args: { lp: address },
        fromBlock: receipt.blockNumber,
        toBlock:   receipt.blockNumber,
      });

      const logArgs = withdrawLogs[0]?.args;
      if (!logArgs?.hasBalHandle || !logArgs?.hasLiqHandle) {
        throw new Error('WithdrawCheckSubmitted event not found');
      }

      // Off-chain decrypt both handles via CoFHE Threshold Network.
      // FHEVault calls FHE.allow(hasBal/hasLiq, lp) so the LP's self-permit is sufficient.
      const [balResult, liqResult] = await Promise.all([
        decryptForTxWithRetry(BigInt(logArgs.hasBalHandle), {
          label: 'withdraw.hasBal',
          retries: 15,
          delayMs: 5000,
          tryWithoutPermitFallback: true,
        }),
        decryptForTxWithRetry(BigInt(logArgs.hasLiqHandle), {
          label: 'withdraw.hasLiq',
          retries: 15,
          delayMs: 5000,
          tryWithoutPermitFallback: true,
        }),
      ]);

      const balPlain = balResult.decryptedValue !== 0n;
      const balSig   = toHexSig(balResult.signature);
      const liqPlain = liqResult.decryptedValue !== 0n;
      const liqSig   = toHexSig(liqResult.signature);

      // Phase 2: finalise withdrawal with proofs
      setStatus('submitting');
      await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'removeLiquidity',
        args: [shares, balPlain, balSig, liqPlain, liqSig],
      });

      setStatus('confirmed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStatus('error');
    }
  }, [address, write, publicClient]);

  const reset = useCallback(() => { setStatus('idle'); setError(null); }, []);

  return { execute, status, error, reset };
}

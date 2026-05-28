import { useState, useCallback } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
  useChainId,
} from 'wagmi';
import { parseUnits, parseAbiItem, type WriteContractParameters } from 'viem';
import { Encryptable } from '@cofhe/sdk';
import {
  getContracts, TOKEN_DECIMALS,
  FHE_ROUTER_ABI, FHE_TOKEN_ABI, FHE_VAULT_ABI, VAULT_EVENTS_ABI,
} from '@/lib/contracts';
import type { CollateralMode } from '@/lib/composability';
import { decryptForTxWithRetry, encryptInputsOnChain, isCofheReady, normaliseEnc, toHexSig } from '@/hooks/useCofhe';
import { useApproveUnderlying } from '@/hooks/useApproveUnderlying';
import { useUnderlyingTokenMeta } from '@/hooks/useUnderlyingToken';

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
  | 'approving_underlying'
  | 'encrypting'
  | 'submitting'
  | 'submitting_check'   // phase-1 submitWithdrawCheck tx in wallet
  | 'awaiting_decrypt'   // waiting for CoFHE TN to decrypt both handles
  | 'confirmed'
  | 'error';

export type { CollateralMode };

export function useAddLiquidity() {
  const [status, setStatus] = useState<VaultTxStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);

  const { data: isOperatorRaw, refetch: refetchOperator } = useReadContract({
    address: contracts.fheToken,
    abi: FHE_TOKEN_ABI,
    functionName: 'isOperator',
    args: [address!, contracts.router],
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
          address: contracts.fheToken,
          abi: FHE_TOKEN_ABI,
          functionName: 'setOperator',
          args: [contracts.router, oneYear],
        });
        await refetchOperator();
      }

      setStatus('encrypting');
      const [encAmount] = await encryptInputsOnChain(chainId, [Encryptable.uint64(amountWei)]);

      setStatus('submitting');
      const fees = await publicClient!.estimateFeesPerGas();
      await write({
        address: contracts.router,
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
  }, [address, isOperatorRaw, write, refetchOperator, publicClient, contracts]);

  const reset = useCallback(() => { setStatus('idle'); setError(null); }, []);

  return { execute, status, error, reset, isOperatorSet: !!isOperatorRaw };
}

/** Deposit plain underlying — vault wraps into encrypted and mints LP shares. */
export function useAddLiquidityPlain() {
  const [status, setStatus] = useState<VaultTxStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const underlying = useUnderlyingTokenMeta();
  const { approve, hasEnoughAllowance } = useApproveUnderlying();
  const publicClient = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();

  const execute = useCallback(
    async (amountStr: string) => {
      if (!address) return;
      setError(null);
      try {
        if (!underlying.configured) {
          throw new Error('Underlying token not configured on vault/router');
        }
        const amountWei = parseUnits(amountStr, underlying.decimals);
        if (!hasEnoughAllowance(amountWei)) {
          setStatus('approving_underlying');
          await approve(amountWei);
        }
        setStatus('submitting');
        const fees = await publicClient!.estimateFeesPerGas();
        await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'addLiquidityPlain',
          args: [amountWei],
          gas: 1_500_000n,
          maxFeePerGas: fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
        setStatus('confirmed');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Transaction failed');
        setStatus('error');
      }
    },
    [address, approve, hasEnoughAllowance, publicClient, underlying.configured, underlying.decimals, write, contracts.router],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { execute, status, error, reset, underlying };
}

export function useRemoveLiquidity() {
  const [status, setStatus] = useState<VaultTxStatus>('idle');
  const [error, setError]   = useState<string | null>(null);

  const { address } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const publicClient               = usePublicClient();
  const { writeContractAsync: write } = useWriteContract();

  const execute = useCallback(async (
    sharesStr: string,
    withdrawMode: CollateralMode = 'encrypted',
  ) => {
    if (!address) return;
    setError(null);
    try {
      const shares = parseUnits(sharesStr, TOKEN_DECIMALS);
      const fees = await publicClient!.estimateFeesPerGas();
      const maxFeePerGas = fees.maxFeePerGas + (fees.maxFeePerGas / 5n); // +20% buffer to avoid baseFee bumps
      const maxPriorityFeePerGas = fees.maxPriorityFeePerGas + (fees.maxPriorityFeePerGas / 5n);

      // Phase 1: submit withdraw check on-chain
      setStatus('submitting_check');
      const phase1Hash = await write({
        address: contracts.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'submitWithdrawCheck',
        args: [shares],
        maxFeePerGas,
        maxPriorityFeePerGas,
      });

      setStatus('awaiting_decrypt');

      // Wait for phase-1 receipt, then read handles from FHEVault event.
      const receipt = await publicClient!.waitForTransactionReceipt({
        hash: phase1Hash,
        timeout: 120_000,
      });

      const withdrawLogs = await publicClient!.getLogs({
        address: contracts.vault as `0x${string}`,
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

      const [balResult, liqResult] = await Promise.all([
        decryptForTxWithRetry(BigInt(logArgs.hasBalHandle), {
          chainId,
          label: 'withdraw.hasBal',
          retries: 15,
          delayMs: 5000,
          tryWithoutPermitFallback: true,
        }),
        decryptForTxWithRetry(BigInt(logArgs.hasLiqHandle), {
          chainId,
          label: 'withdraw.hasLiq',
          retries: 15,
          delayMs: 5000,
          tryWithoutPermitFallback: true,
        }),
      ]);

      const balPlain = balResult.decryptedValue !== 0n;
      const balSig = toHexSig(balResult.signature);
      const liqPlain = liqResult.decryptedValue !== 0n;
      const liqSig = toHexSig(liqResult.signature);

      setStatus('submitting');

      if (withdrawMode === 'wrap') {
        const pending = await publicClient!.readContract({
          address: contracts.vault as `0x${string}`,
          abi: FHE_VAULT_ABI,
          functionName: 'pendingWithdraw',
          args: [address],
        });
        const pendingArr = pending as readonly [unknown, unknown, unknown, unknown];
        const amountHandle = pendingArr[2] as `0x${string}`;
        const amountResult = await decryptForTxWithRetry(BigInt(amountHandle), {
          chainId,
          label: 'withdraw.amount',
          retries: 15,
          delayMs: 5000,
          tryWithoutPermitFallback: true,
        });
        const amountPlain = Number(amountResult.decryptedValue);
        const amountSig = toHexSig(amountResult.signature);

        await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'finalizeLiquidityWithdrawalPlain',
          args: [shares, balPlain, balSig, liqPlain, liqSig, amountPlain, amountSig],
          maxFeePerGas,
          maxPriorityFeePerGas,
        });
      } else {
        await write({
          address: contracts.router,
          abi: FHE_ROUTER_ABI,
          functionName: 'removeLiquidity',
          args: [shares, balPlain, balSig, liqPlain, liqSig],
          maxFeePerGas,
          maxPriorityFeePerGas,
        });
      }

      setStatus('confirmed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStatus('error');
    }
  }, [address, write, publicClient, contracts]);

  const reset = useCallback(() => { setStatus('idle'); setError(null); }, []);

  return { execute, status, error, reset };
}

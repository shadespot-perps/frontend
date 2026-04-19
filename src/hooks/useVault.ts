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
import { cofheClient, normaliseEnc, toHexSig } from '@/hooks/useCofhe';

async function withFreshGas(
  publicClient: ReturnType<typeof usePublicClient>,
): Promise<Pick<WriteContractParameters, 'maxFeePerGas' | 'maxPriorityFeePerGas'>> {
  if (!publicClient) return {};
  try {
    const fees = await publicClient.estimateFeesPerGas();
    const buf = (v: bigint) => (v * 130n) / 100n;
    return {
      maxFeePerGas:         buf(fees.maxFeePerGas         ?? 0n),
      maxPriorityFeePerGas: buf(fees.maxPriorityFeePerGas ?? 0n),
    };
  } catch {
    return {};
  }
}

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
      const amountWei = parseUnits(amountStr, TOKEN_DECIMALS);
      const gas = await withFreshGas(publicClient);

      if (!isOperatorRaw) {
        setStatus('setting_operator');
        const oneYear = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
        await write({
          address: CONTRACTS.fheToken,
          abi: FHE_TOKEN_ABI,
          functionName: 'setOperator',
          args: [CONTRACTS.router, oneYear],
          ...gas,
        });
        await refetchOperator();
      }

      setStatus('encrypting');
      const [encAmount] = await cofheClient
        .encryptInputs([Encryptable.uint64(amountWei)])
        .execute();

      setStatus('submitting');
      const freshGas = await withFreshGas(publicClient);
      await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'addLiquidity',
        args: [normaliseEnc(encAmount)],
        ...freshGas,
      });
      setStatus('confirmed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
      setStatus('error');
    }
  }, [address, isOperatorRaw, write, refetchOperator, publicClient]);

  const reset = useCallback(() => { setStatus('idle'); setError(null); }, []);

  return { execute, status, error, reset };
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
      const phase1Gas = await withFreshGas(publicClient);
      const phase1Hash = await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'submitWithdrawCheck',
        args: [shares],
        ...phase1Gas,
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
      const permit = await cofheClient.permits.getOrCreateSelfPermit();
      const [balResult, liqResult] = await Promise.all([
        cofheClient.decryptForTx(BigInt(logArgs.hasBalHandle)).withPermit(permit).execute(),
        cofheClient.decryptForTx(BigInt(logArgs.hasLiqHandle)).withPermit(permit).execute(),
      ]);

      const balPlain = balResult.decryptedValue !== 0n;
      const balSig   = toHexSig(balResult.signature);
      const liqPlain = liqResult.decryptedValue !== 0n;
      const liqSig   = toHexSig(liqResult.signature);

      // Phase 2: finalise withdrawal with proofs
      setStatus('submitting');
      const phase2Gas = await withFreshGas(publicClient);
      await write({
        address: CONTRACTS.router,
        abi: FHE_ROUTER_ABI,
        functionName: 'removeLiquidity',
        args: [shares, balPlain, balSig, liqPlain, liqSig],
        ...phase2Gas,
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

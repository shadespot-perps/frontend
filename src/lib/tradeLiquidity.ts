import { decodeEventLog, parseAbiItem, type PublicClient } from 'viem';
import type { ShadeSpotContracts } from '@/lib/contracts';
import { decryptForTxWithRetry, toHexSig } from '@/hooks/useCofhe';

const ZERO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * After submitOpenPositionCheck* phase-1, resolve hasLiq handle and CoFHE decrypt proof.
 */
export async function resolveOpenLiquidityProof(
  publicClient: PublicClient,
  chainId: number,
  contracts: ShadeSpotContracts,
  walletAddress: `0x${string}`,
  phase1Hash: `0x${string}`,
): Promise<{ hasLiqPlain: boolean; hasLiqSig: `0x${string}` }> {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: phase1Hash,
    timeout: 120_000,
  });
  const traderForCheck = (receipt.from ?? walletAddress) as `0x${string}`;
  let hasLiqHandle: `0x${string}` | undefined;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contracts.vault.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: [
          parseAbiItem(
            'event ReserveLiquidityCheckSubmitted(address indexed trader, bytes32 hasLiqHandle, bytes32 sizeHandle)',
          ),
        ],
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'ReserveLiquidityCheckSubmitted') {
        hasLiqHandle = decoded.args.hasLiqHandle as `0x${string}`;
      }
    } catch {
      // ignore
    }
  }

  const readPendingHandle = async (trader: `0x${string}`): Promise<`0x${string}` | undefined> => {
    const pending = await publicClient.readContract({
      address: contracts.vault as `0x${string}`,
      abi: [
        {
          type: 'function',
          name: 'pendingLiqCheck',
          stateMutability: 'view',
          inputs: [{ name: 'trader', type: 'address' }],
          outputs: [
            { name: 'hasLiq', type: 'bytes32' },
            { name: 'eSize', type: 'bytes32' },
          ],
        },
      ] as const,
      functionName: 'pendingLiqCheck',
      args: [trader],
    });

    if (Array.isArray(pending)) return pending[0] as `0x${string}`;
    if (pending && typeof pending === 'object' && 'hasLiq' in pending) {
      return (pending as { hasLiq: `0x${string}` }).hasLiq;
    }
    return undefined;
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 8 && (!hasLiqHandle || hasLiqHandle === ZERO_HANDLE); i++) {
    hasLiqHandle = await readPendingHandle(traderForCheck);
    if ((!hasLiqHandle || hasLiqHandle === ZERO_HANDLE) && walletAddress) {
      hasLiqHandle = await readPendingHandle(walletAddress);
    }
    if (!hasLiqHandle || hasLiqHandle === ZERO_HANDLE) await sleep(1000);
  }

  if (!hasLiqHandle || hasLiqHandle === ZERO_HANDLE) {
    const liqLogs = await publicClient.getLogs({
      address: contracts.vault as `0x${string}`,
      event: parseAbiItem(
        'event ReserveLiquidityCheckSubmitted(address indexed trader, bytes32 hasLiqHandle, bytes32 sizeHandle)',
      ),
      args: { trader: traderForCheck },
      fromBlock: receipt.blockNumber > 5_000n ? receipt.blockNumber - 5_000n : 0n,
      toBlock: 'latest',
    });
    hasLiqHandle = liqLogs[liqLogs.length - 1]?.args?.hasLiqHandle as `0x${string}` | undefined;
  }

  if (!hasLiqHandle || hasLiqHandle === ZERO_HANDLE) {
    throw new Error('pendingLiqCheck has no hasLiq handle after open liquidity check');
  }

  const decryptResult = await decryptForTxWithRetry(BigInt(hasLiqHandle), {
    label: 'open.hasLiq',
    chainId,
    retries: 15,
    delayMs: 5000,
    tryWithoutPermitFallback: true,
  });

  return {
    hasLiqPlain: decryptResult.decryptedValue !== 0n,
    hasLiqSig: toHexSig(decryptResult.signature),
  };
}

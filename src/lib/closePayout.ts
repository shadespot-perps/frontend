import type { PublicClient } from 'viem';
import { parseAbiItem } from 'viem';
import { FHE_ROUTER_READ_ABI, POSITION_MANAGER_ABI, type ShadeSpotContracts } from '@/lib/contracts';

export type ClosePayoutMode = 'encrypted' | 'plain';

const plainSettledEvent = parseAbiItem(
  'event PlainPayoutSettled(bytes32 indexed positionKey, address indexed trader, uint64 amount)',
);

async function hasPlainPayoutSettledLog(
  publicClient: PublicClient,
  contracts: ShadeSpotContracts,
  positionKey: `0x${string}`,
  fromBlock: bigint,
): Promise<boolean> {
  const logs = await publicClient.getLogs({
    address: contracts.router,
    event: plainSettledEvent,
    args: { positionKey },
    fromBlock,
    toBlock: 'latest',
  });
  return logs.length > 0;
}

/** Poll until keeper/router completes finalizeClosePlainPayout. */
export async function waitForPlainPayoutSettled(
  publicClient: PublicClient,
  contracts: ShadeSpotContracts,
  positionKey: `0x${string}`,
  opts?: { fromBlock?: bigint; timeoutMs?: number; pollMs?: number },
): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? 600_000;
  const pollMs = opts?.pollMs ?? 4_000;
  const fromBlock = opts?.fromBlock ?? 0n;
  const deadline = Date.now() + timeoutMs;

  // Keeper may have already finalized before we start polling.
  if (await hasPlainPayoutSettledLog(publicClient, contracts, positionKey, fromBlock)) return;

  while (Date.now() < deadline) {
    const [stillRequested, exists, settled] = await Promise.all([
      publicClient.readContract({
        address: contracts.router,
        abi: FHE_ROUTER_READ_ABI,
        functionName: 'plainPayoutRequested',
        args: [positionKey],
      }) as Promise<boolean>,
      publicClient.readContract({
        address: contracts.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'positionExists',
        args: [positionKey],
      }) as Promise<boolean>,
      hasPlainPayoutSettledLog(publicClient, contracts, positionKey, fromBlock),
    ]);

    if (settled || (!exists && !stillRequested)) return;

    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    'Plain USDC settlement timed out (~10 min). Ensure shadespot-backend is running with CLOSE_FINALIZER_ENABLED=true, ' +
      'PRIVATE_KEY is FHERouter.owner, and the vault has plainUnderlyingReserve (plain LP / plain-open).',
  );
}

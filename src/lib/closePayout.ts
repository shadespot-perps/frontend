import type { PublicClient } from 'viem';
import { parseAbiItem } from 'viem';
import { FHE_ROUTER_READ_ABI, POSITION_MANAGER_ABI, type ShadeSpotContracts } from '@/lib/contracts';
import { getLogsChunked } from '@/lib/logScan';

export type ClosePayoutMode = 'encrypted' | 'plain';

const plainSettledEvent = parseAbiItem(
  'event PlainPayoutSettled(bytes32 indexed positionKey, address indexed trader, uint64 amount)',
);

const closeFinalizedEvent = parseAbiItem(
  'event CloseFinalized(bytes32 indexed positionKey, address indexed trader, bytes32 finalAmountHandle)',
);

async function hasPlainPayoutSettledLog(
  publicClient: PublicClient,
  contracts: ShadeSpotContracts,
  positionKey: `0x${string}`,
  fromBlock: bigint,
): Promise<boolean> {
  const logs = await getLogsChunked(publicClient, {
    address: contracts.router,
    event: plainSettledEvent,
    args: { positionKey },
    fromBlock,
  });
  return logs.length > 0;
}

async function hasCloseFinalizedLog(
  publicClient: PublicClient,
  contracts: ShadeSpotContracts,
  positionKey: `0x${string}`,
  fromBlock: bigint,
): Promise<boolean> {
  const logs = await getLogsChunked(publicClient, {
    address: contracts.positionManager,
    event: closeFinalizedEvent,
    args: { positionKey },
    fromBlock,
  });
  return logs.length > 0;
}

type WaitOpts = { fromBlock?: bigint; timeoutMs?: number; pollMs?: number };

/** Poll until keeper/router completes finalizeClosePlainPayout. */
export async function waitForPlainPayoutSettled(
  publicClient: PublicClient,
  contracts: ShadeSpotContracts,
  positionKey: `0x${string}`,
  opts?: WaitOpts,
): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? 600_000;
  const pollMs = opts?.pollMs ?? 4_000;
  const fromBlock = opts?.fromBlock ?? 0n;
  const deadline = Date.now() + timeoutMs;

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
    'Plain settlement timed out (~10 min). Ensure shadespot-backend is running with CLOSE_FINALIZER_ENABLED=true, ' +
      'PRIVATE_KEY is FHERouter.owner, and the vault has plainUnderlyingReserve.',
  );
}

/** Poll until backend finalizer completes finalizeClosePosition (onlyFinalizer on-chain). */
export async function waitForEncryptedCloseFinalized(
  publicClient: PublicClient,
  contracts: ShadeSpotContracts,
  positionKey: `0x${string}`,
  opts?: WaitOpts,
): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? 600_000;
  const pollMs = opts?.pollMs ?? 4_000;
  const fromBlock = opts?.fromBlock ?? 0n;
  const deadline = Date.now() + timeoutMs;

  if (await hasCloseFinalizedLog(publicClient, contracts, positionKey, fromBlock)) return;

  while (Date.now() < deadline) {
    const [exists, finalized] = await Promise.all([
      publicClient.readContract({
        address: contracts.positionManager,
        abi: POSITION_MANAGER_ABI,
        functionName: 'positionExists',
        args: [positionKey],
      }) as Promise<boolean>,
      hasCloseFinalizedLog(publicClient, contracts, positionKey, fromBlock),
    ]);

    if (finalized || !exists) return;

    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    'Encrypted close finalization timed out (~10 min). Ensure shadespot-backend is running with CLOSE_FINALIZER_ENABLED=true ' +
      'and PRIVATE_KEY matches PositionManager.finalizer.',
  );
}

/** Wait for backend keeper to finish close (no wallet finalize tx). */
export async function waitForCloseSettledByKeeper(
  publicClient: PublicClient,
  contracts: ShadeSpotContracts,
  positionKey: `0x${string}`,
  payout: ClosePayoutMode,
  opts?: WaitOpts,
): Promise<void> {
  if (payout === 'plain') {
    await waitForPlainPayoutSettled(publicClient, contracts, positionKey, opts);
  } else {
    await waitForEncryptedCloseFinalized(publicClient, contracts, positionKey, opts);
  }
}

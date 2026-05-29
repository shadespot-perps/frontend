import type { Address, PublicClient } from 'viem';
import { parseAbiItem } from 'viem';
import { getLogsChunked } from '@/lib/logScan';

const POSITION_OPENED = parseAbiItem(
  'event PositionOpened(bytes32 indexed positionKey, address indexed trader, bytes32 sizeHandle, bytes32 collateralHandle, bytes32 isLongHandle)',
);

const ROUTER_OPEN_POSITION = parseAbiItem(
  'event OpenPosition(bytes32 indexed positionKey, address indexed trader)',
);

export type IndexedPositionMeta = {
  positionKey: `0x${string}`;
  blockNumber: number;
};

type CacheEntry = {
  lastScannedBlock: number;
  keys: Record<string, IndexedPositionMeta>;
};

function cacheKey(chainId: number, trader: Address): string {
  return `shadespot:positionIndex:${chainId}:${trader.toLowerCase()}`;
}

function readCache(chainId: number, trader: Address): CacheEntry {
  if (typeof localStorage === 'undefined') {
    return { lastScannedBlock: 0, keys: {} };
  }
  try {
    const raw = localStorage.getItem(cacheKey(chainId, trader));
    if (!raw) return { lastScannedBlock: 0, keys: {} };
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed !== 'object' || !parsed.keys) {
      return { lastScannedBlock: 0, keys: {} };
    }
    return parsed;
  } catch {
    return { lastScannedBlock: 0, keys: {} };
  }
}

function writeCache(chainId: number, trader: Address, entry: CacheEntry): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(cacheKey(chainId, trader), JSON.stringify(entry));
  } catch {
    // quota / private mode — ignore
  }
}

/** Remember a position key immediately after a successful open (before log index catches up). */
export function recordPositionKey(
  chainId: number,
  trader: Address,
  positionKey: `0x${string}`,
  blockNumber?: number,
): void {
  const cache = readCache(chainId, trader);
  const lower = positionKey.toLowerCase();
  const prev = cache.keys[lower];
  cache.keys[lower] = {
    positionKey,
    blockNumber: blockNumber ?? prev?.blockNumber ?? 0,
  };
  if (blockNumber != null && blockNumber > cache.lastScannedBlock) {
    cache.lastScannedBlock = blockNumber;
  }
  writeCache(chainId, trader, cache);
}

export function removePositionKey(chainId: number, trader: Address, positionKey: `0x${string}`): void {
  const cache = readCache(chainId, trader);
  delete cache.keys[positionKey.toLowerCase()];
  writeCache(chainId, trader, cache);
}

function mergeOpenedLogs(
  target: Map<string, IndexedPositionMeta>,
  logs: Awaited<ReturnType<PublicClient['getLogs']>>,
  keyField: 'positionKey',
): void {
  for (const log of logs) {
    const key = log.args[keyField] as `0x${string}` | undefined;
    if (!key) continue;
    const lower = key.toLowerCase();
    const bn = Number(log.blockNumber);
    const prev = target.get(lower);
    if (!prev || bn > prev.blockNumber) {
      target.set(lower, { positionKey: key, blockNumber: bn });
    }
  }
}

/**
 * Discover position keys for a trader:
 * 1. Incremental chunked eth_getLogs (Base Sepolia–safe)
 * 2. Router OpenPosition + PM PositionOpened events
 * 3. Local cache (instant after open, survives RPC log failures)
 */
export async function discoverPositionKeys(params: {
  publicClient: PublicClient;
  chainId: number;
  trader: Address;
  positionManager: Address;
  router: Address;
  deploymentFromBlock: bigint;
}): Promise<IndexedPositionMeta[]> {
  const { publicClient, chainId, trader, positionManager, router, deploymentFromBlock } = params;

  const currentBlock = await publicClient.getBlockNumber();
  const cache = readCache(chainId, trader);

  const merged = new Map<string, IndexedPositionMeta>();
  for (const meta of Object.values(cache.keys)) {
    merged.set(meta.positionKey.toLowerCase(), meta);
  }

  const overlap = 4_000n;
  const scanFrom =
    cache.lastScannedBlock > 0
      ? BigInt(Math.max(0, cache.lastScannedBlock)) - overlap > deploymentFromBlock
        ? BigInt(Math.max(0, cache.lastScannedBlock)) - overlap
        : deploymentFromBlock
      : deploymentFromBlock > 0n
        ? deploymentFromBlock
        : currentBlock > 9_000n
          ? currentBlock - 9_000n
          : 0n;

  const traderArg = { trader };

  const [pmOpened, routerOpened] = await Promise.all([
    getLogsChunked(publicClient, {
      address: positionManager,
      event: POSITION_OPENED,
      args: traderArg,
      fromBlock: scanFrom,
      toBlock: currentBlock,
    }),
    getLogsChunked(publicClient, {
      address: router,
      event: ROUTER_OPEN_POSITION,
      args: traderArg,
      fromBlock: scanFrom,
      toBlock: currentBlock,
    }),
  ]);

  mergeOpenedLogs(merged, pmOpened, 'positionKey');
  mergeOpenedLogs(merged, routerOpened, 'positionKey');

  const nextCache: CacheEntry = {
    lastScannedBlock: Number(currentBlock),
    keys: Object.fromEntries(
      [...merged.entries()].map(([lower, meta]) => [lower, meta]),
    ),
  };
  writeCache(chainId, trader, nextCache);

  return [...merged.values()].sort((a, b) => b.blockNumber - a.blockNumber);
}

/** Extract position keys from an open/finalize transaction receipt. */
export function positionKeysFromReceipt(
  receipt: { logs: { address?: Address; topics: readonly `0x${string}`[]; data: `0x${string}` }[] },
  positionManager: Address,
  router: Address,
): `0x${string}`[] {
  const keys = new Set<string>();
  const pm = positionManager.toLowerCase();
  const rt = router.toLowerCase();

  for (const log of receipt.logs) {
    const addr = log.address?.toLowerCase();
    if (!addr || (addr !== pm && addr !== rt)) continue;
    // Both events index positionKey as topics[1]
    const topic = log.topics[1];
    if (topic && topic.length === 66) {
      keys.add(topic as `0x${string}`);
    }
  }
  return [...keys] as `0x${string}`[];
}

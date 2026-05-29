import type { AbiEvent, Address, PublicClient } from 'viem';

/** Base Sepolia and most public RPCs cap eth_getLogs range (~2k blocks). */
export const LOG_SCAN_CHUNK_BLOCKS = 2_000n;

type ChunkedLogParams = {
  address: Address;
  event: AbiEvent;
  args?: Record<string, unknown>;
  fromBlock: bigint;
  toBlock?: bigint;
};

/**
 * Fetch event logs in block-range chunks so narrow-RPC networks (e.g. Base Sepolia) succeed.
 */
export async function getLogsChunked(
  publicClient: PublicClient,
  params: ChunkedLogParams,
  chunkSize: bigint = LOG_SCAN_CHUNK_BLOCKS,
): Promise<Awaited<ReturnType<PublicClient['getLogs']>>> {
  const toBlock = params.toBlock ?? (await publicClient.getBlockNumber());
  const { fromBlock, ...rest } = params;

  if (toBlock < fromBlock) return [];

  const span = toBlock - fromBlock + 1n;
  if (span <= chunkSize) {
    return publicClient.getLogs({ ...rest, fromBlock, toBlock });
  }

  const all: Awaited<ReturnType<PublicClient['getLogs']>> = [];
  for (let from = fromBlock; from <= toBlock; from += chunkSize) {
    const to = from + chunkSize - 1n > toBlock ? toBlock : from + chunkSize - 1n;
    const chunk = await publicClient.getLogs({ ...rest, fromBlock: from, toBlock: to });
    all.push(...chunk);
  }
  return all;
}

import { useEffect, useRef } from 'react';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { getContracts, getFromBlock } from '@/lib/contracts';
import { useStore, type Position } from '@/store/useStore';
import { parseAbiItem } from 'viem';

const PAIR = 'ETH-USD';

export function usePositions() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const fromBlockDefault = getFromBlock(chainId);
  const setPositions = useStore(s => s.setPositions);

  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;

    if (!address || !publicClient) {
      setPositions([]);
      return;
    }

    const pmAddress = contracts.positionManager as `0x${string}`;

    async function load() {
      try {
        const currentBlock = await publicClient!.getBlockNumber();
        const fromBlock =
          fromBlockDefault > 0n
            ? fromBlockDefault
            : (currentBlock > 9_000n ? currentBlock - 9_000n : 0n);

        // NOTE: PositionManager.openPositionFHE() does NOT populate getMyPositionKey().
        // So we index positions from the PositionOpened event and then confirm they still exist.
        const opened = await publicClient!.getLogs({
          address: pmAddress,
          event: parseAbiItem(
            'event PositionOpened(bytes32 indexed positionKey, address indexed trader, bytes32 sizeHandle, bytes32 collateralHandle, bytes32 isLongHandle)'
          ),
          args: { trader: address as `0x${string}` },
          fromBlock,
          toBlock: 'latest',
        });

        if (abortRef.current) return;

        const openedMeta = new Map<string, { blockNumber: number; positionKey: `0x${string}` }>();
        for (const l of opened) {
          const key = l.args.positionKey as `0x${string}` | undefined;
          if (!key) continue;
          const bn = Number(l.blockNumber);
          const prev = openedMeta.get(key.toLowerCase());
          if (!prev || bn > prev.blockNumber) {
            openedMeta.set(key.toLowerCase(), { blockNumber: bn, positionKey: key });
          }
        }

        const uniqueKeys = [...openedMeta.values()]
          .sort((a, b) => b.blockNumber - a.blockNumber)
          .map((m) => m.positionKey);

        if (uniqueKeys.length === 0) {
          setPositions([]);
          return;
        }

        const existsFlags = await Promise.all(
          uniqueKeys.map((key) =>
            publicClient!.readContract({
              address: pmAddress,
              abi: [
                {
                  name: 'positionExists',
                  type: 'function',
                  stateMutability: 'view',
                  inputs: [{ name: 'key', type: 'bytes32' }],
                  outputs: [{ name: '', type: 'bool' }],
                },
              ] as const,
              functionName: 'positionExists',
              args: [key],
            }) as Promise<boolean>
          )
        );

        if (abortRef.current) return;

        const positions: Position[] = uniqueKeys
          .filter((_, i) => existsFlags[i])
          .map((key, i) => {
            const existing = useStore.getState().positions.find(p => p.positionKey === key);

            // We can't know side from plaintext from events; keep it "encrypted" unless we already decrypted.
            // (We decrypt isLong/entryPrice/etc on-demand and then preserve those fields on refresh.)
            const isPreserved = existing && (existing.status === 'decrypted' || existing.status === 'decrypting');
            const meta = openedMeta.get(key.toLowerCase());
            return {
              // Stable id per on-chain positionKey to avoid wiping decrypted state when ordering changes.
              id:               `${key}`,
              pool:             'fhe',
              pair:             PAIR,
              side:             isPreserved ? existing.side : 'long', // placeholder
              positionKey:      key,
              openedBlockNumber: meta?.blockNumber,
              size:             isPreserved ? existing.size : 0,
              collateral:       isPreserved ? existing.collateral : 0,
              leverage:         isPreserved ? existing.leverage : 0,
              entryPrice:       isPreserved ? existing.entryPrice : 0,
              markPrice:        isPreserved ? existing.markPrice : 0,
              pnl:              isPreserved ? existing.pnl : 0,
              pnlPercent:       isPreserved ? existing.pnlPercent : 0,
              liquidationPrice: isPreserved ? existing.liquidationPrice : 0,
              status:           isPreserved ? existing.status : 'encrypted',
              openedAt:         isPreserved ? existing.openedAt : new Date().toISOString(),
            };
          });

        setPositions(positions);
      } catch (err) {
        console.error('[usePositions] error:', err);
      }
    }

    load();
    return () => { abortRef.current = true; };
  }, [address, publicClient, setPositions, contracts.positionManager, fromBlockDefault]);
}

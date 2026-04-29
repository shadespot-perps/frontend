import { useEffect, useRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { CONTRACTS, FROM_BLOCK, INDEX_TOKEN } from '@/lib/contracts';
import { useStore, type Position } from '@/store/useStore';
import { parseAbiItem } from 'viem';

const PAIR = 'ETH-USD';

export function usePositions() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const setPositions = useStore(s => s.setPositions);

  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;

    if (!address || !publicClient) {
      setPositions([]);
      return;
    }

    const pmAddress = CONTRACTS.positionManager as `0x${string}`;

    async function load() {
      try {
        // NOTE: PositionManager.openPositionFHE() does NOT populate getMyPositionKey().
        // So we index positions from the PositionOpened event and then confirm they still exist.
        const opened = await publicClient!.getLogs({
          address: pmAddress,
          event: parseAbiItem(
            'event PositionOpened(bytes32 indexed positionKey, address indexed trader, bytes32 sizeHandle, bytes32 collateralHandle, bytes32 isLongHandle)'
          ),
          args: { trader: address as `0x${string}` },
          fromBlock: FROM_BLOCK,
          toBlock: 'latest',
        });

        if (abortRef.current) return;

        const uniqueKeys = Array.from(
          new Set(opened.map(l => l.args.positionKey as `0x${string}`).filter(Boolean))
        );

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
            // We can't know side from plaintext; keep it "encrypted" in UI.
            // (We *could* decrypt isLongHandle later, but current UX assumes encrypted.)
            return {
              id:               `${address}-${i}-${key}`,
              pool:             'fhe',
              pair:             PAIR,
              side:             'long', // placeholder; UI treats everything as encrypted anyway
              positionKey:      key,
              size:             0,
              collateral:       0,
              leverage:         0,
              entryPrice:       0,
              markPrice:        0,
              pnl:              0,
              pnlPercent:       0,
              liquidationPrice: 0,
              status:           'encrypted',
              openedAt:         new Date().toISOString(),
            };
          });

        setPositions(positions);
      } catch (err) {
        console.error('[usePositions] error:', err);
      }
    }

    load();
    return () => { abortRef.current = true; };
  }, [address, publicClient, setPositions]);
}

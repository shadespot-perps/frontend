import { useEffect, useRef } from 'react';
import { useAccount, useChainId, usePublicClient } from 'wagmi';
import { getContracts, getFromBlock } from '@/lib/contracts';
import { discoverPositionKeys } from '@/lib/positionIndex';
import { useStore, type Position } from '@/store/useStore';

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
    const routerAddress = contracts.router as `0x${string}`;
    const trader = address as `0x${string}`;

    async function load() {
      try {
        const indexed = await discoverPositionKeys({
          publicClient: publicClient!,
          chainId,
          trader,
          positionManager: pmAddress,
          router: routerAddress,
          deploymentFromBlock: fromBlockDefault,
        });

        if (abortRef.current) return;

        const uniqueKeys = indexed.map(m => m.positionKey);

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

        const openedMeta = new Map(
          indexed.map(m => [m.positionKey.toLowerCase(), m]),
        );

        const positions: Position[] = uniqueKeys
          .filter((_, i) => existsFlags[i])
          .map((key) => {
            const existing = useStore.getState().positions.find(p => p.positionKey === key);
            const isPreserved = existing && (existing.status === 'decrypted' || existing.status === 'decrypting');
            const meta = openedMeta.get(key.toLowerCase());
            return {
              id: `${key}`,
              pool: 'fhe' as const,
              pair: PAIR,
              side: isPreserved ? existing.side : 'long',
              positionKey: key,
              openedBlockNumber: meta?.blockNumber,
              size: isPreserved ? existing.size : 0,
              collateral: isPreserved ? existing.collateral : 0,
              leverage: isPreserved ? existing.leverage : 0,
              entryPrice: isPreserved ? existing.entryPrice : 0,
              markPrice: isPreserved ? existing.markPrice : 0,
              pnl: isPreserved ? existing.pnl : 0,
              pnlPercent: isPreserved ? existing.pnlPercent : 0,
              liquidationPrice: isPreserved ? existing.liquidationPrice : 0,
              status: isPreserved ? existing.status : 'encrypted',
              openedAt: isPreserved ? existing.openedAt : new Date().toISOString(),
            };
          });

        setPositions(positions);
      } catch (err) {
        console.error('[usePositions] error:', err);
        // Keep existing UI state on transient RPC failures (e.g. rate limits).
      }
    }

    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => {
      abortRef.current = true;
      clearInterval(interval);
    };
  }, [
    address,
    publicClient,
    setPositions,
    contracts.positionManager,
    contracts.router,
    fromBlockDefault,
    chainId,
  ]);
}

import { useEffect, useRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { CONTRACTS, POSITION_MANAGER_ABI, INDEX_TOKEN } from '@/lib/contracts';
import { useStore, type Position } from '@/store/useStore';

const PAIR = 'ETH-USD';

function readExists(raw: unknown): boolean {
  if (!raw) return false;
  if (typeof (raw as any).exists === 'boolean') return (raw as any).exists;
  if (Array.isArray(raw)) return raw[7] === true;
  return false;
}

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
        const [longKey, shortKey] = await Promise.all([
          publicClient!.readContract({
            address: pmAddress, abi: POSITION_MANAGER_ABI,
            functionName: 'getPositionKey',
            args: [address as `0x${string}`, INDEX_TOKEN as `0x${string}`, true],
          }),
          publicClient!.readContract({
            address: pmAddress, abi: POSITION_MANAGER_ABI,
            functionName: 'getPositionKey',
            args: [address as `0x${string}`, INDEX_TOKEN as `0x${string}`, false],
          }),
        ]) as [`0x${string}`, `0x${string}`];

        if (abortRef.current) return;

        const [longRaw, shortRaw] = await Promise.all([
          publicClient!.readContract({
            address: pmAddress, abi: POSITION_MANAGER_ABI,
            functionName: 'positions', args: [longKey],
          }),
          publicClient!.readContract({
            address: pmAddress, abi: POSITION_MANAGER_ABI,
            functionName: 'positions', args: [shortKey],
          }),
        ]);

        if (abortRef.current) return;

        const longExists  = readExists(longRaw);
        const shortExists = readExists(shortRaw);

        if (!longExists && !shortExists) {
          setPositions([]);
          return;
        }

        // PositionOpened emits only encrypted handles (bytes32) — size, collateral,
        // and isLong are never available as plaintext. Show position as encrypted.
        const positions: Position[] = [];
        for (const isLong of [true, false] as const) {
          if (isLong ? !longExists : !shortExists) continue;

          positions.push({
            id:               `${address}-${isLong ? 'long' : 'short'}`,
            pool:             'fhe',
            pair:             PAIR,
            side:             isLong ? 'long' : 'short',
            positionKey:      (isLong ? longKey : shortKey) as `0x${string}`,
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
          });
        }

        setPositions(positions);
      } catch (err) {
        console.error('[usePositions] error:', err);
      }
    }

    load();
    return () => { abortRef.current = true; };
  }, [address, publicClient, setPositions]);
}

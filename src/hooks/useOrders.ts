import { useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';
import { CONTRACTS, ORDER_MANAGER_ABI, FROM_BLOCK } from '@/lib/contracts';
import { useStore, type Order } from '@/store/useStore';

const PAIR = 'ETH-USD';

export function useOrders() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const setOrders = useStore(s => s.setOrders);
  const removeOrder = useStore(s => s.cancelOrder);

  useEffect(() => {
    if (!address || !publicClient) {
      setOrders([]);
      return;
    }

    let cancelled = false;
    let inFlight = false;
    const omAddress = CONTRACTS.orderManager as `0x${string}`;

    async function fetch() {
      try {
        if (inFlight) return;
        inFlight = true;
        const currentBlock = await publicClient!.getBlockNumber();
        const fromBlock = FROM_BLOCK;

        const createdLogs = await publicClient!.getLogs({
          address: omAddress,
          event: parseAbiItem('event OrderCreated(uint256 indexed orderId, address indexed trader, address token, bytes32 collateralHandle)'),
          args: { trader: address },
          fromBlock,
          toBlock: currentBlock,
        });

        if (cancelled) return;

        const existingIds = useStore.getState().orders.map(o => o.id);
        const createdIds = createdLogs
          .map(l => l.args.orderId)
          .filter((x): x is bigint => typeof x === 'bigint')
          .map(x => x.toString());

        const ids = Array.from(new Set([...existingIds, ...createdIds]));
        if (ids.length === 0) {
          setOrders([]);
          return;
        }

        // NOTE: `getOrderMeta` is permissioned (trader or router only), so public reads will revert.
        // Build list from events + public `isOrderActive(orderId)`.
        const activeFlags = await Promise.all(ids.map(async (idStr) => {
          const orderId = BigInt(idStr);
          try {
            const isActive = await publicClient!.readContract({
              address: omAddress,
              abi: ORDER_MANAGER_ABI,
              functionName: 'isOrderActive',
              args: [orderId],
            }) as boolean;
            return { idStr, isActive };
          } catch {
            return { idStr, isActive: false };
          }
        }));

        if (cancelled) return;

        const orders: Order[] = activeFlags
          .filter(x => x.isActive)
          .map((x) => ({
            id: x.idStr,
            pool: 'fhe' as const,
            pair: PAIR,
            side: 'long' as const,
            type: 'limit' as const,
            size: 0,
            price: 0,
            status: 'pending' as const,
            createdAt: new Date().toISOString(),
            encrypted: true,
          }));

        setOrders(orders);
      } catch (err) {
        console.error('[useOrders] fetch error:', err);
      } finally {
        inFlight = false;
      }
    }

    fetch();

    const unwatch = publicClient.watchBlockNumber({
      poll: true,
      pollingInterval: 5_000,
      onBlockNumber: () => void fetch(),
    });

    // Also remove orders as soon as we see them executed/cancelled.
    const unwatchExecuted = publicClient.watchEvent({
      address: omAddress,
      event: parseAbiItem('event OrderExecuted(uint256 indexed orderId, address indexed trader)'),
      args: { trader: address },
      fromBlock: FROM_BLOCK,
      poll: true,
      pollingInterval: 5_000,
      onLogs: (logs) => {
        for (const l of logs) {
          const id = l.args?.orderId;
          if (id != null) removeOrder(id.toString());
        }
      },
    });

    const unwatchCancelled = publicClient.watchEvent({
      address: omAddress,
      event: parseAbiItem('event OrderCancelled(uint256 indexed orderId)'),
      fromBlock: FROM_BLOCK,
      poll: true,
      pollingInterval: 5_000,
      onLogs: (logs) => {
        for (const l of logs) {
          const id = l.args?.orderId;
          if (id != null) removeOrder(id.toString());
        }
      },
    });

    return () => {
      cancelled = true;
      unwatch?.();
      unwatchExecuted?.();
      unwatchCancelled?.();
    };
  }, [address, publicClient, setOrders, removeOrder]);
}

import { useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { parseAbiItem } from 'viem';
import { CONTRACTS, ORDER_MANAGER_ABI, FROM_BLOCK } from '@/lib/contracts';
import { useStore, type Order } from '@/store/useStore';

const PAIR = 'ETH-USD';
const FHE_DECIMALS = 1e18;

export function useOrders() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const setOrders = useStore(s => s.setOrders);

  useEffect(() => {
    if (!address || !publicClient) {
      setOrders([]);
      return;
    }

    let cancelled = false;
    const omAddress = CONTRACTS.orderManager as `0x${string}`;

    async function fetch() {
      try {
        const currentBlock = await publicClient!.getBlockNumber();
        const fromBlock = currentBlock > 200000n
          ? currentBlock - 200000n > FROM_BLOCK ? currentBlock - 200000n : FROM_BLOCK
          : FROM_BLOCK;

        const createdLogs = await publicClient!.getLogs({
          address: omAddress,
          event: parseAbiItem('event OrderCreated(uint256 indexed orderId, address indexed trader, address token)'),
          args: { trader: address },
          fromBlock,
          toBlock: currentBlock,
        });

        if (cancelled || createdLogs.length === 0) {
          if (!cancelled) setOrders([]);
          return;
        }

        const metas = await Promise.all(
          createdLogs.map(async log => {
            const orderId = log.args.orderId!;
            try {
              const meta = await publicClient!.readContract({
                address: omAddress,
                abi: ORDER_MANAGER_ABI,
                functionName: 'getOrderMeta',
                args: [orderId],
              }) as {
                trader: `0x${string}`;
                token: `0x${string}`;
                collateral: bigint;
                leverage: bigint;
                isLong: boolean;
                isActive: boolean;
              };
              return { orderId, meta };
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        const orders: Order[] = metas
          .filter((m): m is NonNullable<typeof m> => m !== null && m.meta.isActive)
          .map(({ orderId, meta }) => {
            const collateralPlain = Number(meta.collateral) / FHE_DECIMALS;
            const sizePlain = collateralPlain * Number(meta.leverage);
            return {
              id: orderId.toString(),
              pool: 'fhe' as const,
              pair: PAIR,
              side: meta.isLong ? 'long' as const : 'short' as const,
              type: 'limit' as const,
              size: sizePlain,
              price: 0,
              status: 'pending' as const,
              createdAt: new Date().toISOString(),
              encrypted: true,
            };
          });

        setOrders(orders);
      } catch (err) {
        console.error('[useOrders] fetch error:', err);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [address, publicClient, setOrders]);
}

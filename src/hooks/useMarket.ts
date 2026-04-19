import { useReadContract } from 'wagmi';
import {
  CONTRACTS, INDEX_TOKEN,
  PRICE_ORACLE_ABI, FUNDING_RATE_MANAGER_ABI,
} from '@/lib/contracts';
import { useStore } from '@/store/useStore';
import { useEffect } from 'react';

export function useMarketData() {
  const updateMarket = useStore((s) => s.updateMarket);

  const { data: priceRaw } = useReadContract({
    address: CONTRACTS.priceOracle,
    abi: PRICE_ORACLE_ABI,
    functionName: 'getPrice',
    args: [INDEX_TOKEN],
    query: { refetchInterval: 5_000 },
  });

  const { data: fundingRaw } = useReadContract({
    address: CONTRACTS.fundingRateManager,
    abi: FUNDING_RATE_MANAGER_ABI,
    functionName: 'getFundingRate',
    args: [INDEX_TOKEN],
    query: { refetchInterval: 15_000 },
  });

  const { data: oiRaw } = useReadContract({
    address: CONTRACTS.fundingRateManager,
    abi: FUNDING_RATE_MANAGER_ABI,
    functionName: 'getOpenInterest',
    args: [INDEX_TOKEN],
    query: { refetchInterval: 15_000 },
  });

  useEffect(() => {
    const patch: Parameters<typeof updateMarket>[0] = {};

    if (priceRaw !== undefined) {
      const price = Number(priceRaw) / 1e8;
      patch.markPrice = price;
      patch.indexPrice = price;
    }

    if (fundingRaw !== undefined) {
      patch.fundingRate = Number(fundingRaw) / 1e10;
    }

    if (oiRaw !== undefined) {
      const [longOI, shortOI] = oiRaw as [bigint, bigint];
      patch.openInterest = Number(longOI + shortOI);
    }

    if (Object.keys(patch).length > 0) updateMarket(patch);
  }, [priceRaw, fundingRaw, oiRaw, updateMarket]);
}

import { useChainId, useReadContract } from 'wagmi';
import {
  getContracts, getIndexToken,
  PRICE_ORACLE_ABI, FUNDING_RATE_MANAGER_ABI,
} from '@/lib/contracts';
import { useStore } from '@/store/useStore';
import { useEffect } from 'react';

export function useMarketData(options?: { includePrice?: boolean }) {
  const updateMarket = useStore((s) => s.updateMarket);
  const includePrice = options?.includePrice ?? true;
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const indexToken = getIndexToken(chainId);

  const { data: priceRaw } = useReadContract({
    address: contracts.priceOracle,
    abi: PRICE_ORACLE_ABI,
    functionName: 'getPrice',
    args: [indexToken],
    query: { enabled: includePrice, refetchInterval: 5_000 },
  });

  const { data: fundingRaw } = useReadContract({
    address: contracts.fundingRateManager,
    abi: FUNDING_RATE_MANAGER_ABI,
    functionName: 'getFundingRate',
    args: [indexToken],
    query: { refetchInterval: 15_000 },
  });

  const { data: oiRaw } = useReadContract({
    address: contracts.fundingRateManager,
    abi: FUNDING_RATE_MANAGER_ABI,
    functionName: 'getOpenInterest',
    args: [indexToken],
    query: { refetchInterval: 15_000 },
  });

  useEffect(() => {
    const patch: Parameters<typeof updateMarket>[0] = {};

    if (includePrice && priceRaw !== undefined) {
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
  }, [includePrice, priceRaw, fundingRaw, oiRaw, updateMarket]);
}

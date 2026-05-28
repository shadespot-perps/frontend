import { formatUnits } from 'viem';
import { TOKEN_DECIMALS } from '@/lib/contracts';

export const UINT64_MAX = 18_446_744_073_709_551_615n;

/** Collateral source for trade / LP flows. */
export type CollateralMode = 'encrypted' | 'wrap';

/**
 * Plain paths use uint64 amounts (euint64). Ensures parsed collateral fits.
 */
export function assertUint64Amount(amountWei: bigint, decimals = TOKEN_DECIMALS): bigint {
  if (amountWei < 0n || amountWei > UINT64_MAX) {
    throw new Error(
      `Amount exceeds on-chain uint64 limit (max ${formatUnits(UINT64_MAX, decimals)} token units)`,
    );
  }
  return amountWei;
}

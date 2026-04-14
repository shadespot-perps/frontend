import { cn } from '@/lib/utils';
import type { Pool } from '@/store/useStore';

export function PoolBadge({ pool, className }: { pool: Pool; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase rounded border',
      pool === 'pool1'
        ? 'bg-shade-blue/10 text-shade-blue border-shade-blue/30'
        : 'bg-shade-teal/10 text-shade-teal border-shade-teal/30',
      className
    )}>
      {pool === 'pool1' ? '⬡ Pool 1 · USDC' : '⬡ Pool 2 · FHE'}
    </span>
  );
}

import { cn } from '@/lib/utils';
import type { Pool } from '@/store/useStore';

export function PoolBadge({ pool: _pool, className }: { pool: Pool; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase rounded border',
      'bg-shade-teal/10 text-shade-teal border-shade-teal/30',
      className
    )}>
      ⬡ FHE Pool
    </span>
  );
}

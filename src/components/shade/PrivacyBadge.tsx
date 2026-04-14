import { cn } from '@/lib/utils';
import type { PrivacyLevel } from '@/store/useStore';

const badgeStyles: Record<PrivacyLevel, string> = {
  ZK: 'bg-shade-teal/15 text-shade-teal border-shade-teal/30',
  DP: 'bg-shade-amber/15 text-shade-amber border-shade-amber/30',
  PUBLIC: 'bg-shade-text-muted/15 text-shade-text-muted border-shade-text-muted/30',
};

export function PrivacyBadge({ level, className }: { level: PrivacyLevel; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase border rounded',
      badgeStyles[level],
      className
    )}>
      {level === 'ZK' && '⬡ '}
      {level}
    </span>
  );
}

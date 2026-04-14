import { cn } from '@/lib/utils';

interface HeatmapBarProps {
  value: number; // 0 to 1
  className?: string;
}

export function HeatmapBar({ value, className }: HeatmapBarProps) {
  const color = value < 0.33 ? 'bg-shade-green' : value < 0.66 ? 'bg-shade-amber' : 'bg-shade-red';
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-secondary overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${Math.min(value * 100, 100)}%` }}
      />
    </div>
  );
}

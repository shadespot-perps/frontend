import { cn } from '@/lib/utils';
import type { CollateralMode } from '@/lib/composability';
import { Layers } from 'lucide-react';

type Props = {
  value: CollateralMode;
  onChange: (mode: CollateralMode) => void;
  underlyingSymbol?: string;
  disabled?: boolean;
  className?: string;
};

export function CollateralModeToggle({
  value,
  onChange,
  underlyingSymbol = 'USDC',
  disabled,
  className,
}: Props) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <Layers className="w-3 h-3" /> Collateral source
      </label>
      <div className="grid grid-cols-2 gap-1 p-0.5 bg-secondary rounded-md">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('encrypted')}
          className={cn(
            'py-1.5 px-2 text-[11px] font-medium rounded transition-colors',
            value === 'encrypted'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Pre-encrypted FHE
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('wrap')}
          className={cn(
            'py-1.5 px-2 text-[11px] font-medium rounded transition-colors',
            value === 'wrap'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Wrap {underlyingSymbol}
        </button>
      </div>
      {value === 'wrap' && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Router pulls plain {underlyingSymbol}, wraps to encrypted collateral, then opens the position.
        </p>
      )}
    </div>
  );
}

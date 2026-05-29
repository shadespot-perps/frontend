import { cn } from '@/lib/utils';
import type { ClosePayoutMode } from '@/lib/closePayout';
import { Banknote, Lock } from 'lucide-react';
import { InfoPopover } from '@/components/ui/InfoPopover';

type Props = {
  value: ClosePayoutMode;
  onChange: (mode: ClosePayoutMode) => void;
  underlyingSymbol?: string;
  disabled?: boolean;
  className?: string;
};

export function ClosePayoutToggle({
  value,
  onChange,
  underlyingSymbol = 'USDC',
  disabled,
  className,
}: Props) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-xs text-muted-foreground flex items-center gap-1">
        <Banknote className="w-3 h-3" /> Settlement payout
      </label>
      <div className="grid grid-cols-2 gap-1 p-0.5 bg-secondary rounded-md">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('encrypted')}
          className={cn(
            'py-1.5 px-2 text-[11px] font-medium rounded transition-colors flex items-center justify-center gap-1',
            value === 'encrypted'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Lock className="w-3 h-3 shrink-0" />
          FHE tokens
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('plain')}
          className={cn(
            'py-1.5 px-2 text-[11px] font-medium rounded transition-colors flex items-center justify-center gap-1',
            value === 'plain'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Banknote className="w-3 h-3 shrink-0" />
          Plain {underlyingSymbol}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {value === 'plain'
            ? `Plain ${underlyingSymbol} payout is public on-chain after the backend finalizer settles.`
            : 'FHE token payout stays encrypted; backend finalizer completes close on-chain.'}
        </p>
        <InfoPopover
          label="Flow"
          content={
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your wallet only signs the close request. shadespot-backend decrypts settlement handles and
              submits finalize (no second MetaMask prompt). Works the same on Arbitrum Sepolia, ETH Sepolia,
              and Base Sepolia.
            </p>
          }
        />
      </div>
    </div>
  );
}

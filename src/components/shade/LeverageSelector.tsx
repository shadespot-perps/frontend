import { cn } from '@/lib/utils';

const presets = [1, 2, 5, 10];

interface LeverageSelectorProps {
  value: number;
  onChange: (v: number) => void;
}

export function LeverageSelector({ value, onChange }: LeverageSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Leverage</span>
        <span className="font-mono text-sm text-shade-teal font-semibold">{value}x</span>
      </div>
      <div className="flex gap-1.5">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              'flex-1 py-1.5 text-xs font-mono rounded border transition-all',
              value === p
                ? 'bg-shade-teal/15 border-shade-teal/50 text-shade-teal'
                : 'bg-secondary border-border text-muted-foreground hover:border-shade-teal/30'
            )}
          >
            {p}x
          </button>
        ))}
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-shade-teal bg-secondary rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-shade-teal"
      />
    </div>
  );
}

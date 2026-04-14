import { useStore } from '@/store/useStore';
import { PoolBadge } from '@/components/shade/PoolBadge';
import { cn } from '@/lib/utils';

export default function HistoryPage() {
  const { history } = useStore();

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-4 animate-fade-in">
      <h1 className="text-xl font-semibold text-foreground">Trade History</h1>

      <div className="shade-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-shade-bg-secondary">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Pair</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Side</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Pool</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Size</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Entry</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Exit</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">PnL</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Closed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{h.pair}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-semibold', h.side === 'long' ? 'text-shade-green' : 'text-shade-red')}>
                      {h.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3"><PoolBadge pool={h.pool} /></td>
                  <td className="px-4 py-3 text-right font-mono">{h.size}</td>
                  <td className="px-4 py-3 text-right font-mono">${h.entryPrice.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">${h.exitPrice.toLocaleString()}</td>
                  <td className={cn('px-4 py-3 text-right font-mono font-semibold', h.pnl >= 0 ? 'text-shade-green' : 'text-shade-red')}>
                    {h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)} ({h.pnlPercent >= 0 ? '+' : ''}{h.pnlPercent.toFixed(2)}%)
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                    {new Date(h.closedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

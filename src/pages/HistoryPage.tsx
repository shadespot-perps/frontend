import { useStore } from '@/store/useStore';
import { PoolBadge } from '@/components/shade/PoolBadge';
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/PageShell';

export default function HistoryPage() {
  const { history } = useStore();

  return (
    <PageShell
      title="Trade history"
      subtitle="Executed trades and closed positions. Values remain private unless decrypted."
      width="2xl"
    >
      <div className="shade-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-shade-bg-secondary/80 backdrop-blur">
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
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No history yet
                  </td>
                </tr>
              ) : (
                history.map((h, idx) => (
                  <tr
                    key={h.id}
                    className={cn(
                      "border-b border-border/50 transition-colors hover:bg-accent/30",
                      idx % 2 === 1 && "bg-background/30",
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{h.pair}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          h.side === "long" ? "text-shade-green" : "text-shade-red",
                        )}
                      >
                        {h.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PoolBadge pool={h.pool} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{h.size}</td>
                    <td className="px-4 py-3 text-right font-mono">${h.entryPrice.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono">${h.exitPrice.toLocaleString()}</td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-mono font-semibold",
                        h.pnl >= 0 ? "text-shade-green" : "text-shade-red",
                      )}
                    >
                      {h.pnl >= 0 ? "+" : ""}${h.pnl.toFixed(2)} (
                      {h.pnlPercent >= 0 ? "+" : ""}
                      {h.pnlPercent.toFixed(2)}%)
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                      {new Date(h.closedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}

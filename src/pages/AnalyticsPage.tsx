import { PrivacyBadge } from '@/components/shade/PrivacyBadge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Activity, BarChart3, TrendingUp, Users } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { PageShell } from '@/components/layout/PageShell';

export default function AnalyticsPage() {
  const { market } = useStore();

  const stats = [
    {
      label: 'Long/Short Ratio',
      value: '—',
      badge: 'DP' as const,
      icon: Users,
      sub: 'Coming soon',
    },
    {
      label: 'Funding Rate',
      value: market.markPrice > 0 ? `${market.fundingRate >= 0 ? '+' : ''}${market.fundingRate.toFixed(4)}%` : '—',
      badge: 'ZK' as const,
      icon: Activity,
      sub: 'On-chain (non-ZK) for now',
    },
    {
      label: '24h Volume',
      value: '—',
      badge: 'ZK' as const,
      icon: BarChart3,
      sub: 'Coming soon',
    },
    {
      label: 'Open Interest',
      value: market.markPrice > 0 && market.openInterest > 0 ? `$${(market.openInterest / 1e6).toFixed(2)}M` : '—',
      badge: 'DP' as const,
      icon: TrendingUp,
      sub: 'On-chain (non-DP) for now',
    },
  ];

  return (
    <PageShell
      title="Analytics"
      subtitle="Network-wide metrics. Some aggregates are coming soon."
      actions={(
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-shade-bg-secondary/60 border border-border/70">
          <span className="text-xs text-muted-foreground">Legend</span>
          <PrivacyBadge level="ZK" />
          <PrivacyBadge level="DP" />
          <PrivacyBadge level="PUBLIC" />
        </div>
      )}
    >

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="shade-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-shade-teal" />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <PrivacyBadge level={s.badge} />
              </div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">{s.value}</p>
              <p className="text-[11px] text-shade-text-muted">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Liquidation Heatmap */}
      <div className="shade-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Liquidation Heatmap</h2>
          <PrivacyBadge level="DP" />
        </div>
        <div className="p-4 rounded-md bg-secondary/40 border border-border text-xs text-muted-foreground">
          Coming soon. DP bucket aggregates will appear once the pipeline is wired.
        </div>
      </div>

      {/* Funding History */}
      <div className="shade-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Funding Rate History (8h epochs)</h2>
          <PrivacyBadge level="ZK" />
        </div>
        <div className="p-4 rounded-md bg-secondary/40 border border-border text-xs text-muted-foreground">
          Coming soon. Funding epoch data will appear once available.
        </div>
      </div>

      {/* Volume Chart */}
      <div className="shade-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">30-Day Volume</h2>
          <PrivacyBadge level="ZK" />
        </div>
        <div className="p-4 rounded-md bg-secondary/40 border border-border text-xs text-muted-foreground">
          Coming soon. ZK-proven aggregate volume will appear once ready.
        </div>
      </div>

      {/* How Numbers Are Computed */}
      <Accordion type="single" collapsible>
        <AccordionItem value="how" className="shade-card border-border">
          <AccordionTrigger className="px-5 text-sm font-semibold text-foreground hover:no-underline">
            How These Numbers Are Computed
          </AccordionTrigger>
          <AccordionContent className="px-5 pb-5 space-y-3 text-xs text-muted-foreground leading-relaxed">
            <p><strong className="text-foreground">ZK-Proven Aggregates:</strong> Volume and funding rates are computed via zero-knowledge proofs. Individual trades are never revealed; only the mathematically-verified aggregate is published on-chain.</p>
            <p><strong className="text-foreground">Differential Privacy (DP):</strong> Open interest and long/short ratios use differential privacy with calibrated noise (ε = 1.0). This means the displayed number is approximately correct but individual positions cannot be reverse-engineered.</p>
            <p><strong className="text-foreground">Liquidation Buckets:</strong> The heatmap shows bucket-level aggregates. Each bucket covers a $20 price range. Individual liquidation prices are never revealed.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </PageShell>
  );
}

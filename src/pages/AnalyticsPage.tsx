import { PrivacyBadge } from '@/components/shade/PrivacyBadge';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { BarChart3, Activity, TrendingUp, Users } from 'lucide-react';

const stats = [
  { label: 'Long/Short Ratio', value: '1.24', badge: 'DP' as const, icon: Users, sub: '55.4% Long' },
  { label: 'Funding Rate', value: '+0.0082%', badge: 'ZK' as const, icon: Activity, sub: 'Next: 04:23:17' },
  { label: '24h Volume', value: '$284.7M', badge: 'ZK' as const, icon: BarChart3, sub: 'ZK-proven aggregate' },
  { label: 'Open Interest', value: '$1.24B', badge: 'DP' as const, icon: TrendingUp, sub: 'ε = 1.0 noise' },
];

const fundingData = Array.from({ length: 21 }).map((_, i) => ({
  epoch: i,
  rate: (Math.random() - 0.45) * 0.02,
}));

export default function AnalyticsPage() {
  return (
    <div className="max-w-[1200px] mx-auto p-4 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-shade-bg-secondary border border-border">
          <span className="text-xs text-muted-foreground">Privacy Legend:</span>
          <PrivacyBadge level="ZK" />
          <PrivacyBadge level="DP" />
          <PrivacyBadge level="PUBLIC" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="shade-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-shade-teal" />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <PrivacyBadge level={s.badge} />
              </div>
              <p className="text-2xl font-mono font-bold text-foreground">{s.value}</p>
              <p className="text-[11px] text-shade-text-muted">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Liquidation Heatmap */}
      <div className="shade-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Liquidation Heatmap</h2>
          <PrivacyBadge level="DP" />
        </div>
        <div className="flex items-end gap-[2px] h-32">
          {Array.from({ length: 40 }).map((_, i) => {
            const intensity = Math.random();
            const color = intensity < 0.33 ? 'bg-shade-teal' : intensity < 0.66 ? 'bg-shade-amber' : 'bg-shade-red';
            return (
              <div
                key={i}
                className={cn('flex-1 rounded-sm transition-all', color)}
                style={{ height: `${10 + intensity * 90}%`, opacity: 0.3 + intensity * 0.7 }}
                title={`$${(3200 + i * 20).toLocaleString()} — ${(intensity * 50).toFixed(0)} positions`}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>$3,200</span>
          <span>$3,600</span>
          <span>$4,000</span>
        </div>
      </div>

      {/* Funding History */}
      <div className="shade-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Funding Rate History (8h epochs)</h2>
          <PrivacyBadge level="ZK" />
        </div>
        <div className="flex items-end justify-center gap-1 h-32">
          {fundingData.map((d, i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <div
                className={cn(
                  'w-full rounded-sm',
                  d.rate >= 0 ? 'bg-shade-green/60' : 'bg-shade-red/60'
                )}
                style={{ height: `${Math.abs(d.rate) * 5000 + 4}px` }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Volume Chart */}
      <div className="shade-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">30-Day Volume</h2>
          <PrivacyBadge level="ZK" />
        </div>
        <div className="flex items-end gap-[2px] h-32">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-shade-teal/40 hover:bg-shade-teal/60 rounded-sm transition-colors"
              style={{ height: `${20 + Math.random() * 80}%` }}
            />
          ))}
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
    </div>
  );
}

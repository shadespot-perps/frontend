import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Vote, FileText, Settings, Clock } from 'lucide-react';

const recentDecisions = [
  { title: 'Reduce minimum collateral to $50', status: 'passed', date: '2024-03-01' },
  { title: 'Add SOL-USD perpetual market', status: 'passed', date: '2024-02-20' },
  { title: 'Increase funding rate cap to 0.05%', status: 'rejected', date: '2024-02-15' },
];

const parameters = [
  { name: 'Max Leverage', value: '10x', governance: true },
  { name: 'Liquidation Threshold', value: '90%', governance: true },
  { name: 'Min Collateral', value: '$50 USDC', governance: true },
  { name: 'Funding Rate Cap', value: '±0.03%', governance: true },
  { name: 'LP Withdrawal Delay', value: '24 hours', governance: true },
  { name: 'Oracle Source', value: 'Chainlink + Pyth', governance: false },
];

export default function GovernPage() {
  const { proposals, wallet } = useStore();

  return (
    <div className="max-w-[1200px] mx-auto p-4 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Governance</h1>
        <Button size="sm" disabled={!wallet.connected} className="gradient-teal text-shade-bg-primary font-semibold text-xs">
          Propose a Change
        </Button>
      </div>

      {/* Active Proposals */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Vote className="w-4 h-4 text-shade-teal" /> Active Proposals
        </h2>
        {proposals.filter(p => p.status === 'active').length === 0 ? (
          <div className="shade-card p-8 text-center">
            <Vote className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No active proposals</p>
            <p className="text-xs text-shade-text-muted mt-1">Create one to start a governance discussion.</p>
          </div>
        ) : (
          proposals.filter(p => p.status === 'active').map(prop => {
            const total = prop.votesFor + prop.votesAgainst;
            const forPct = total > 0 ? (prop.votesFor / total) * 100 : 0;
            return (
              <div key={prop.id} className="shade-card p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{prop.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{prop.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Ends {new Date(prop.endsAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-shade-green">For: {(prop.votesFor / 1e6).toFixed(2)}M</span>
                    <span className="text-shade-red">Against: {(prop.votesAgainst / 1e6).toFixed(2)}M</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden flex">
                    <div className="h-full bg-shade-green/60 rounded-l-full" style={{ width: `${forPct}%` }} />
                    <div className="h-full bg-shade-red/60 rounded-r-full" style={{ width: `${100 - forPct}%` }} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 border-shade-green/30 text-shade-green text-xs" disabled={!wallet.connected}>Vote For</Button>
                  <Button size="sm" variant="outline" className="flex-1 border-shade-red/30 text-shade-red text-xs" disabled={!wallet.connected}>Vote Against</Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Recent Decisions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-shade-teal" /> Recent Decisions
        </h2>
        <div className="space-y-2">
          {recentDecisions.map((d, i) => (
            <div key={i} className="shade-card p-4 flex items-center justify-between">
              <span className="text-sm text-foreground">{d.title}</span>
              <div className="flex items-center gap-3">
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', d.status === 'passed' ? 'bg-shade-green/15 text-shade-green' : 'bg-shade-red/15 text-shade-red')}>
                  {d.status.toUpperCase()}
                </span>
                <span className="text-xs text-muted-foreground">{d.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Parameter Registry */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Settings className="w-4 h-4 text-shade-teal" /> Parameter Registry
        </h2>
        <div className="shade-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-shade-bg-secondary">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Parameter</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Current Value</th>
                <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Governance</th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((p, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-4 py-3 text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.value}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('text-xs', p.governance ? 'text-shade-teal' : 'text-muted-foreground')}>
                      {p.governance ? 'DAO' : 'Fixed'}
                    </span>
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

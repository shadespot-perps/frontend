import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Key, Bell, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { PageShell } from '@/components/layout/PageShell';

export default function SettingsPage() {
  const { permits, revokePermit, wallet } = useStore();
  const [notifications, setNotifications] = useState({
    liquidationWarning: true,
    orderFilled: true,
    fundingPayment: false,
    governanceVote: true,
  });

  return (
    <PageShell
      title="Settings"
      subtitle="Manage permits, notifications, and operator status."
      width="lg"
    >

      {/* Active Permits */}
      <div className="shade-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Key className="w-4 h-4 text-shade-teal" /> Active Permits
        </h2>
        {permits.filter(p => p.active).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No active permits</p>
        ) : (
          <div className="space-y-2">
            {permits.filter(p => p.active).map((permit) => (
              <div key={permit.id} className="flex items-center justify-between gap-3 p-4 rounded-xl bg-secondary/40 border border-border/70">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-foreground">{permit.recipient}</span>
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase',
                      permit.accessLevel === 'full' ? 'bg-shade-amber/15 text-shade-amber' : 'bg-shade-teal/15 text-shade-teal'
                    )}>
                      {permit.accessLevel}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Expires {new Date(permit.expiresAt).toLocaleDateString()} · Created {new Date(permit.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revokePermit(permit.id)} className="text-shade-red hover:text-shade-red hover:bg-shade-red/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="shade-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell className="w-4 h-4 text-shade-teal" /> Notification Preferences
        </h2>
        <div className="space-y-3">
          {Object.entries(notifications).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded-xl bg-secondary/30 border border-border/60 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {key === 'liquidationWarning' && 'Warn me when liquidation risk increases.'}
                  {key === 'orderFilled' && 'Notify when an order is executed.'}
                  {key === 'fundingPayment' && 'Funding rate settlements and receipts.'}
                  {key === 'governanceVote' && 'Protocol votes and parameter updates.'}
                </p>
              </div>
              <Switch
                checked={val}
                onCheckedChange={() => setNotifications(n => ({ ...n, [key]: !val }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pool 2 Operator */}
      <div className="shade-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-shade-teal" /> FHE Pool Operator Status
        </h2>
        {wallet.connected ? (
          wallet.isOperator ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-shade-green/10 border border-shade-green/20">
              <div className="w-2 h-2 rounded-full bg-shade-green" />
              <span className="text-sm text-shade-green">Operator Active</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                The FHE pool requires operator setup to manage encrypted collateral. This is a one-time process.
              </p>
              <Button className="gradient-teal text-shade-bg-primary font-semibold text-xs">
                Setup Operator
              </Button>
            </div>
          )
        ) : (
          <p className="text-sm text-muted-foreground">Connect wallet to manage operator status.</p>
        )}
      </div>
    </PageShell>
  );
}

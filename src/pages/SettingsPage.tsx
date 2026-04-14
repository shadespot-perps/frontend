import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Key, Bell, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function SettingsPage() {
  const { permits, revokePermit, wallet } = useStore();
  const [notifications, setNotifications] = useState({
    liquidationWarning: true,
    orderFilled: true,
    fundingPayment: false,
    governanceVote: true,
  });

  return (
    <div className="max-w-[900px] mx-auto p-4 space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold text-foreground">Settings</h1>

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
              <div key={permit.id} className="flex items-center justify-between p-3 rounded-md bg-secondary/50 border border-border">
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
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <button
                onClick={() => setNotifications(n => ({ ...n, [key]: !val }))}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors relative',
                  val ? 'bg-shade-teal' : 'bg-secondary'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-all',
                  val ? 'left-5.5 left-[22px]' : 'left-0.5'
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Pool 2 Operator */}
      <div className="shade-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-shade-teal" /> Pool 2 Operator Status
        </h2>
        {wallet.connected ? (
          wallet.isPool2Operator ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-shade-green/10 border border-shade-green/20">
              <div className="w-2 h-2 rounded-full bg-shade-green" />
              <span className="text-sm text-shade-green">Operator Active</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pool 2 requires operator setup to manage encrypted collateral. This is a one-time process.
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
    </div>
  );
}

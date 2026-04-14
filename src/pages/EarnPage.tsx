import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { PoolBadge } from '@/components/shade/PoolBadge';
import { EncryptedField } from '@/components/shade/EncryptedField';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { TrendingUp, AlertTriangle, Info } from 'lucide-react';

function VaultUtilMeter({ value }: { value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Utilisation</span>
        <span className="font-mono text-foreground">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', value < 0.7 ? 'bg-shade-green' : value < 0.9 ? 'bg-shade-amber' : 'bg-shade-red')}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function EarnPage() {
  const { activePool, setActivePool, wallet, lpPosition } = useStore();
  const [amount, setAmount] = useState('');

  const vaultStats = {
    pool1: { tvl: 847000000, util: 0.62, apy7d: 12.4, apy30d: 11.8 },
    pool2: { tvl: 124000000, util: 0.74, apy7d: 18.7, apy30d: 16.2 },
  };

  const stats = vaultStats[activePool];

  return (
    <div className="max-w-[1200px] mx-auto p-4 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Earn</h1>
        <div className="flex gap-2">
          {(['pool1', 'pool2'] as const).map(pool => (
            <button
              key={pool}
              onClick={() => setActivePool(pool)}
              className={cn(
                'px-3 py-1.5 text-xs font-mono rounded-md border transition-all',
                activePool === pool ? 'border-shade-teal/50 bg-shade-teal/10 text-shade-teal' : 'border-border text-muted-foreground hover:border-shade-teal/20'
              )}
            >
              {pool === 'pool1' ? 'Pool 1 · USDC' : 'Pool 2 · FHE'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: Vault Stats + Performance */}
        <div className="space-y-4">
          {/* Vault Stats */}
          <div className="shade-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-shade-teal" /> Vault Statistics
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">TVL</span>
                <p className="text-lg font-mono font-semibold text-foreground mt-0.5">
                  ${(stats.tvl / 1e6).toFixed(0)}M
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">7d APY</span>
                <p className="text-lg font-mono font-semibold text-shade-green mt-0.5">{stats.apy7d}%</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">30d APY</span>
                <p className="text-lg font-mono font-semibold text-shade-green mt-0.5">{stats.apy30d}%</p>
              </div>
              <div>
                <VaultUtilMeter value={stats.util} />
              </div>
            </div>
          </div>

          {/* My LP Position */}
          <div className="shade-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">My LP Position</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">Deposited</span>
                <div className="mt-1">
                  {activePool === 'pool2' ? (
                    <EncryptedField value={`$${lpPosition.pool2.toLocaleString()}`} status="encrypted" />
                  ) : (
                    <p className="font-mono text-foreground">${lpPosition.pool1.toLocaleString()}</p>
                  )}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Current APY</span>
                <p className="font-mono text-shade-green mt-1">
                  {activePool === 'pool1' ? lpPosition.pool1Apy : lpPosition.pool2Apy}%
                </p>
              </div>
            </div>
          </div>

          {/* Revenue chart placeholder */}
          <div className="shade-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Pool Performance</h2>
            <div className="h-48 flex items-center justify-center border border-border/50 rounded-md bg-shade-bg-secondary">
              <div className="text-center space-y-2">
                <div className="flex gap-1 justify-center">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-2 bg-shade-teal/40 rounded-sm"
                      style={{ height: `${20 + Math.random() * 100}px` }}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">30-Day Revenue</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Add Liquidity */}
        <div className="space-y-4">
          <div className="shade-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Add Liquidity</h2>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs text-muted-foreground">Amount</label>
                <span className="text-xs text-muted-foreground font-mono">
                  Balance: {activePool === 'pool1' ? `${wallet.balanceUSDC.toLocaleString()} USDC` : `${wallet.balanceFHE.toLocaleString()} FHE`}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-shade-text-muted focus:outline-none focus:border-shade-teal/50"
                />
                <button onClick={() => setAmount(activePool === 'pool1' ? wallet.balanceUSDC.toString() : wallet.balanceFHE.toString())} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-shade-teal">MAX</button>
              </div>
            </div>

            {parseFloat(amount) > 0 && (
              <div className="p-3 bg-secondary/50 rounded-md space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated APY</span>
                  <span className="font-mono text-shade-green">{activePool === 'pool1' ? stats.apy7d : stats.apy7d}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Monthly Yield</span>
                  <span className="font-mono text-foreground">
                    ${((parseFloat(amount) * stats.apy7d / 100) / 12).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <Button className="w-full gradient-teal text-shade-bg-primary font-semibold" disabled={!wallet.connected || !parseFloat(amount)}>
              {wallet.connected ? 'Deposit Liquidity' : 'Connect Wallet'}
            </Button>
          </div>

          {/* Risk Callout */}
          <div className="shade-card p-4 border-shade-amber/20 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-shade-amber" />
              <span className="text-sm font-semibold text-shade-amber">LP Risk Disclosure</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Liquidity providers act as the counterparty to traders. Your capital is at risk if traders
              are collectively profitable. Returns are not guaranteed. Past performance does not indicate future results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

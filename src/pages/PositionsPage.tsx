import { useStore, type Position } from '@/store/useStore';
import { EncryptedField } from '@/components/shade/EncryptedField';
import { DecryptButton } from '@/components/shade/DecryptButton';
import { PoolBadge } from '@/components/shade/PoolBadge';
import { HeatmapBar } from '@/components/shade/HeatmapBar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Unlock, Share2 } from 'lucide-react';

export default function PositionsPage() {
  const { positions, decryptPosition } = useStore();
  const [permitModal, setPermitModal] = useState<string | null>(null);
  const [permitAddr, setPermitAddr] = useState('');
  const [permitLevel, setPermitLevel] = useState<'size' | 'pnl' | 'full'>('pnl');
  const { addPermit } = useStore();

  const handleBatchDecrypt = () => {
    positions.filter(p => p.status === 'encrypted').forEach(p => decryptPosition(p.id));
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Positions</h1>
        <Button variant="outline" size="sm" onClick={handleBatchDecrypt} className="border-shade-teal/30 text-shade-teal text-xs">
          <Unlock className="w-3.5 h-3.5 mr-1.5" /> Batch Decrypt All
        </Button>
      </div>

      {positions.length === 0 ? (
        <div className="shade-card p-12 text-center">
          <p className="text-muted-foreground">No open positions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((pos) => (
            <div key={pos.id} className="shade-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{pos.pair}</span>
                  <span className={cn(
                    'text-xs font-semibold px-1.5 py-0.5 rounded',
                    pos.side === 'long' ? 'bg-shade-green/15 text-shade-green' : 'bg-shade-red/15 text-shade-red'
                  )}>
                    {pos.side.toUpperCase()} {pos.leverage}x
                  </span>
                  <PoolBadge pool={pos.pool} />
                </div>
                <div className="flex items-center gap-2">
                  <DecryptButton status={pos.status} onDecrypt={() => decryptPosition(pos.id)} />
                  {pos.status === 'decrypted' && (
                    <Button variant="outline" size="sm" className="text-xs border-shade-teal/30 text-shade-teal" onClick={() => setPermitModal(pos.id)}>
                      <Share2 className="w-3.5 h-3.5 mr-1" /> Share Permit
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Size</span>
                  <div className="mt-1"><EncryptedField value={`${pos.size} ETH`} status={pos.status} /></div>
                </div>
                <div>
                  <span className="text-muted-foreground">PnL</span>
                  <div className="mt-1">
                    {pos.status === 'encrypted' ? (
                      <span className="font-mono text-shade-text-muted">~${Math.round(pos.pnl / 10) * 10}</span>
                    ) : (
                      <EncryptedField
                        value={`${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)} (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)`}
                        status={pos.status}
                        className={pos.pnl >= 0 ? 'text-shade-green' : 'text-shade-red'}
                      />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Entry Price</span>
                  <div className="mt-1"><EncryptedField value={`$${pos.entryPrice.toLocaleString()}`} status={pos.status} /></div>
                </div>
                <div>
                  <span className="text-muted-foreground">Liq. Price</span>
                  <div className="mt-1"><EncryptedField value={`$${pos.liquidationPrice.toLocaleString()}`} status={pos.status} className="text-shade-red" /></div>
                </div>
              </div>

              <div className="mt-3">
                <span className="text-[10px] text-muted-foreground">Liquidation Risk</span>
                <HeatmapBar value={Math.abs(pos.markPrice - pos.liquidationPrice) / pos.markPrice < 0.1 ? 0.8 : 0.2} className="mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Share Permit Modal */}
      <Dialog open={!!permitModal} onOpenChange={() => setPermitModal(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Share Permit</DialogTitle>
            <DialogDescription>Grant selective access to your position data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Recipient Address</label>
              <input value={permitAddr} onChange={e => setPermitAddr(e.target.value)} placeholder="0x..." className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-shade-text-muted focus:outline-none focus:border-shade-teal/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Access Level</label>
              <div className="flex gap-2">
                {(['size', 'pnl', 'full'] as const).map(l => (
                  <button key={l} onClick={() => setPermitLevel(l)} className={cn('flex-1 py-1.5 text-xs rounded border capitalize', permitLevel === l ? 'border-shade-teal/50 bg-shade-teal/10 text-shade-teal' : 'border-border text-muted-foreground')}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={() => { addPermit({ recipient: permitAddr, accessLevel: permitLevel, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), active: true }); setPermitModal(null); setPermitAddr(''); }} className="w-full gradient-teal text-shade-bg-primary font-semibold">
              Create Permit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

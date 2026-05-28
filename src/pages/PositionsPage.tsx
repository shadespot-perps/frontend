import { useStore } from '@/store/useStore';
import { EncryptedField } from '@/components/shade/EncryptedField';
import { DecryptButton } from '@/components/shade/DecryptButton';
import { PoolBadge } from '@/components/shade/PoolBadge';
import { HeatmapBar } from '@/components/shade/HeatmapBar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Unlock } from 'lucide-react';
import { useMarketData } from '@/hooks/useMarket';
import { useDecryptPosition } from '@/hooks/useDecryptPosition';
import { PageShell } from '@/components/layout/PageShell';

export default function PositionsPage() {
  useMarketData();
  const positions = useStore(s => s.positions);
  const decryptPosition = useDecryptPosition();

  const handleBatchDecrypt = async () => {
    const targets = positions.filter(p => p.status === 'encrypted');
    for (const p of targets) {
      // Sequential to avoid CoFHE decrypt-for-tx nonce races across positions.
      await decryptPosition(p.id);
    }
  };

  return (
    <PageShell
      title="Positions"
      subtitle="Your open positions. Decrypt to reveal private fields."
      width="2xl"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleBatchDecrypt}
          className="border-shade-teal/30 text-shade-teal text-xs rounded-full"
        >
          <Unlock className="w-3.5 h-3.5 mr-1.5" /> Batch decrypt
        </Button>
      }
    >
      {positions.length === 0 ? (
        <div className="shade-card p-10 sm:p-14 text-center">
          <p className="font-display text-lg font-semibold text-foreground">Nothing open</p>
          <p className="mt-2 text-sm text-muted-foreground">Your next position will show up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((pos) => (
            <div key={pos.id} className="shade-card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{pos.pair}</span>
                  <span
                    className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full',
                      pos.status === 'decrypted'
                        ? (pos.side === 'long'
                          ? 'bg-shade-green/15 text-shade-green'
                          : 'bg-shade-red/15 text-shade-red')
                        : 'bg-secondary/70 text-muted-foreground',
                    )}
                  >
                    {pos.status === 'decrypted'
                      ? `${pos.side.toUpperCase()} ${pos.leverage}x`
                      : pos.status === 'decrypting'
                        ? 'DECRYPTING'
                        : 'ENCRYPTED'}
                  </span>
                  <PoolBadge pool={pos.pool} />
                </div>
                <DecryptButton status={pos.status} onDecrypt={() => decryptPosition(pos.id)} />
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Size</span>
                  <div className="mt-1">
                    <EncryptedField
                      value={pos.status === 'decrypted' ? `${pos.size.toFixed(4)} FHE` : '**** FHE'}
                      status={pos.status}
                    />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">PnL</span>
                  <div className="mt-1">
                    {pos.status === 'encrypted' ? (
                      <span className="font-mono text-shade-text-muted">—</span>
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
                  <div className="mt-1">
                    <EncryptedField
                      value={pos.status === 'decrypted' ? `$${pos.entryPrice.toLocaleString()}` : '****'}
                      status={pos.status}
                    />
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Liq. Price</span>
                  <div className="mt-1">
                    <EncryptedField
                      value={pos.status === 'decrypted' ? `$${pos.liquidationPrice.toLocaleString()}` : '****'}
                      status={pos.status}
                      className={pos.status === 'decrypted' ? 'text-shade-red' : undefined}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Liquidation risk</span>
                <HeatmapBar
                  value={
                    pos.status === 'decrypted' && pos.markPrice > 0
                      ? (Math.abs(pos.markPrice - pos.liquidationPrice) / pos.markPrice < 0.1 ? 0.8 : 0.2)
                      : 0.2
                  }
                  className="mt-1"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

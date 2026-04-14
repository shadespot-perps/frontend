import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { PriceDisplay } from '@/components/shade/PriceDisplay';
import { PrivacyBadge } from '@/components/shade/PrivacyBadge';
import { EncryptedField } from '@/components/shade/EncryptedField';
import { DecryptButton } from '@/components/shade/DecryptButton';
import { PoolBadge } from '@/components/shade/PoolBadge';
import { LeverageSelector } from '@/components/shade/LeverageSelector';
import { HeatmapBar } from '@/components/shade/HeatmapBar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, X as XIcon, Info, Shield } from 'lucide-react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, type IChartApi } from 'lightweight-charts';

// --- Chart Component ---
function TradingChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApi = useRef<IChartApi | null>(null);
  const { market } = useStore();

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: 'hsl(220, 18%, 5%)' }, textColor: 'hsl(215, 15%, 50%)' },
      grid: { vertLines: { color: 'hsl(220, 14%, 10%)' }, horzLines: { color: 'hsl(220, 14%, 10%)' } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: 'hsl(220, 14%, 14%)' },
      timeScale: { borderColor: 'hsl(220, 14%, 14%)', timeVisible: true },
      width: chartRef.current.clientWidth,
      height: 400,
    });
    chartApi.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444', borderDownColor: '#ef4444', borderUpColor: '#22c55e',
      wickDownColor: '#ef4444', wickUpColor: '#22c55e',
    });

    // Generate mock candle data
    const now = Math.floor(Date.now() / 1000);
    const candles = [];
    let price = 3500;
    for (let i = 200; i >= 0; i--) {
      const time = now - i * 3600;
      const open = price;
      const change = (Math.random() - 0.48) * 40;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * 20;
      const low = Math.min(open, close) - Math.random() * 20;
      candles.push({ time, open, high, low, close });
      price = close;
    }
    candleSeries.setData(candles as any);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'hsl(160, 90%, 43%)',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    
    const volumes = candles.map(c => ({
      time: c.time,
      value: Math.random() * 5000 + 500,
      color: c.close >= c.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
    }));
    volumeSeries.setData(volumes as any);

    // Mark price line
    candleSeries.createPriceLine({
      price: market.markPrice,
      color: 'hsl(160, 90%, 43%)',
      lineWidth: 1,
      lineStyle: 2,
      axisLabelVisible: true,
      title: 'Mark',
    });

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  return <div ref={chartRef} className="w-full" />;
}

// --- Ticker Bar ---
function TickerBar() {
  const { market } = useStore();
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border bg-shade-bg-secondary overflow-x-auto">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-foreground">{market.pair}</span>
        <PriceDisplay price={market.markPrice} size="md" className="text-foreground font-semibold" />
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">24h</span>
        <span className={cn('text-xs font-mono', market.change24h >= 0 ? 'text-shade-green' : 'text-shade-red')}>
          {market.change24h >= 0 ? '+' : ''}{market.change24h}%
        </span>
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <PrivacyBadge level="DP" />
        <span className="text-xs text-muted-foreground">OI</span>
        <span className="text-xs font-mono text-foreground">${(market.openInterest / 1e9).toFixed(2)}B</span>
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <PrivacyBadge level="ZK" />
        <span className="text-xs text-muted-foreground">Funding</span>
        <span className={cn('text-xs font-mono', market.fundingRate >= 0 ? 'text-shade-green' : 'text-shade-red')}>
          {market.fundingRate >= 0 ? '+' : ''}{market.fundingRate}%
        </span>
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <PrivacyBadge level="ZK" />
        <span className="text-xs text-muted-foreground">Vol</span>
        <span className="text-xs font-mono text-foreground">${(market.volume24h / 1e6).toFixed(1)}M</span>
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">TVL</span>
        <span className="text-xs font-mono text-foreground">${(market.vaultTVL / 1e6).toFixed(0)}M</span>
      </div>
    </div>
  );
}

// --- Order Panel ---
function OrderPanel() {
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [collateral, setCollateral] = useState('');
  const [leverage, setLeverage] = useState(5);
  const [limitPrice, setLimitPrice] = useState('');
  const { wallet, activePool, market } = useStore();

  const collateralNum = parseFloat(collateral) || 0;
  const size = collateralNum * leverage;
  const sizeInAsset = size / market.markPrice;

  return (
    <div className="shade-card p-4 space-y-4 h-full">
      {/* Long/Short Toggle */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-secondary rounded-lg">
        <button
          onClick={() => setSide('long')}
          className={cn(
            'py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5',
            side === 'long' ? 'bg-shade-green/15 text-shade-green' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <TrendingUp className="w-4 h-4" /> Long
        </button>
        <button
          onClick={() => setSide('short')}
          className={cn(
            'py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5',
            side === 'short' ? 'bg-shade-red/15 text-shade-red' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <TrendingDown className="w-4 h-4" /> Short
        </button>
      </div>

      {/* Order type tabs */}
      <div className="flex gap-1 p-0.5 bg-secondary rounded-md">
        {(['market', 'limit', 'stop'] as const).map(t => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded capitalize transition-colors',
              orderType === t ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Limit price */}
      {orderType !== 'market' && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{orderType === 'limit' ? 'Limit' : 'Stop'} Price</label>
          <div className="relative">
            <input
              type="number"
              value={limitPrice}
              onChange={e => setLimitPrice(e.target.value)}
              placeholder={market.markPrice.toString()}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-shade-text-muted focus:outline-none focus:border-shade-teal/50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">USD</span>
          </div>
        </div>
      )}

      {/* Collateral Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs text-muted-foreground">Collateral</label>
          <span className="text-xs text-muted-foreground font-mono">
            Balance: {activePool === 'pool1' ? `${wallet.balanceUSDC.toLocaleString()} USDC` : `${wallet.balanceFHE.toLocaleString()} FHE`}
          </span>
        </div>
        <div className="relative">
          <input
            type="number"
            value={collateral}
            onChange={e => setCollateral(e.target.value)}
            placeholder="0.00"
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-shade-text-muted focus:outline-none focus:border-shade-teal/50"
          />
          <button
            onClick={() => setCollateral(activePool === 'pool1' ? wallet.balanceUSDC.toString() : wallet.balanceFHE.toString())}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-shade-teal hover:text-shade-teal/80"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Leverage */}
      <LeverageSelector value={leverage} onChange={setLeverage} />

      {/* Order Summary */}
      {collateralNum > 0 && (
        <div className="space-y-2 p-3 bg-secondary/50 rounded-md border border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Position Size</span>
            <span className="font-mono text-foreground">${size.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Size ({market.pair.split('-')[0]})</span>
            <span className="font-mono text-foreground">{sizeInAsset.toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Entry Price</span>
            <span className="font-mono text-foreground">${market.markPrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Liq. Price (est.)</span>
            <span className="font-mono text-shade-red">
              ${(side === 'long'
                ? market.markPrice * (1 - 0.9 / leverage)
                : market.markPrice * (1 + 0.9 / leverage)
              ).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* FHE Note */}
      <div className="flex items-start gap-2 p-2.5 rounded-md bg-shade-teal/5 border border-shade-teal/10">
        <Shield className="w-3.5 h-3.5 text-shade-teal mt-0.5 shrink-0" />
        <p className="text-[11px] text-shade-text-secondary leading-relaxed">
          {activePool === 'pool1'
            ? 'Your position size and PnL are encrypted via FHE. Only you can decrypt.'
            : 'Pool 2: Maximum privacy. Your collateral balance, position, and PnL are all FHE-encrypted.'
          }
        </p>
      </div>

      {/* CTA */}
      <Button
        className={cn(
          'w-full font-semibold text-sm py-5',
          side === 'long'
            ? 'bg-shade-green hover:bg-shade-green/90 text-background'
            : 'bg-shade-red hover:bg-shade-red/90 text-foreground'
        )}
        disabled={!wallet.connected || collateralNum <= 0}
      >
        {!wallet.connected ? 'Connect Wallet' : `${side === 'long' ? 'Long' : 'Short'} ${market.pair}`}
      </Button>
    </div>
  );
}

// --- Position Panel ---
function PositionPanel() {
  const { positions, decryptPosition, activePool } = useStore();
  const poolPositions = positions.filter(p => p.pool === activePool);

  if (poolPositions.length === 0) {
    return (
      <div className="shade-card p-6 text-center">
        <p className="text-sm text-muted-foreground">No open positions</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {poolPositions.map((pos) => (
        <div key={pos.id} className="shade-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{pos.pair}</span>
              <span className={cn(
                'text-xs font-semibold px-1.5 py-0.5 rounded',
                pos.side === 'long' ? 'bg-shade-green/15 text-shade-green' : 'bg-shade-red/15 text-shade-red'
              )}>
                {pos.side.toUpperCase()} {pos.leverage}x
              </span>
              <PoolBadge pool={pos.pool} />
            </div>
            <DecryptButton status={pos.status} onDecrypt={() => decryptPosition(pos.id)} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Size</span>
              <div className="mt-0.5">
                <EncryptedField value={`${pos.size} ETH`} status={pos.status} className="text-foreground" />
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">PnL</span>
              <div className="mt-0.5">
                <EncryptedField
                  value={`${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)} (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)`}
                  status={pos.status}
                  className={pos.pnl >= 0 ? 'text-shade-green' : 'text-shade-red'}
                />
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Entry</span>
              <div className="mt-0.5">
                <EncryptedField value={`$${pos.entryPrice.toLocaleString()}`} status={pos.status} className="text-foreground" />
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Liq. Price</span>
              <div className="mt-0.5">
                <EncryptedField value={`$${pos.liquidationPrice.toLocaleString()}`} status={pos.status} className="text-shade-red" />
              </div>
            </div>
          </div>

          {/* Liquidation risk bar */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground">Liquidation Risk</span>
            <HeatmapBar value={Math.abs(pos.markPrice - pos.liquidationPrice) / pos.markPrice < 0.1 ? 0.8 : 0.2} />
          </div>

          {pos.status === 'decrypted' && (
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="text-xs flex-1">Close Position</Button>
              <Button variant="outline" size="sm" className="text-xs border-shade-teal/30 text-shade-teal">Share Permit</Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Orders Tab ---
function OrdersTab() {
  const { orders, cancelOrder, activePool } = useStore();
  const poolOrders = orders.filter(o => o.pool === activePool);

  if (poolOrders.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No pending orders</p>;
  }

  return (
    <div className="space-y-2">
      {poolOrders.map((order) => (
        <div key={order.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border">
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-xs font-semibold px-1.5 py-0.5 rounded',
              order.side === 'long' ? 'bg-shade-green/15 text-shade-green' : 'bg-shade-red/15 text-shade-red'
            )}>
              {order.side.toUpperCase()}
            </span>
            <span className="text-sm font-medium">{order.pair}</span>
            <span className="text-xs text-muted-foreground uppercase">{order.type}</span>
            <span className="text-xs font-mono text-foreground">@ ${order.price.toLocaleString()}</span>
          </div>
          <button onClick={() => cancelOrder(order.id)} className="p-1 text-muted-foreground hover:text-shade-red">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Trade Page ---
export default function TradePage() {
  const { activePool, setActivePool, market } = useStore();

  // Simulate price updates
  useEffect(() => {
    const { updatePrice } = useStore.getState();
    const interval = setInterval(() => {
      const delta = (Math.random() - 0.48) * 5;
      const current = useStore.getState().market.markPrice;
      updatePrice(Math.round((current + delta) * 100) / 100);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fade-in">
      <TickerBar />

      {/* Pool selector */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-shade-bg-primary">
        {(['pool1', 'pool2'] as const).map(pool => (
          <button
            key={pool}
            onClick={() => setActivePool(pool)}
            className={cn(
              'px-3 py-1.5 text-xs font-mono rounded-md border transition-all',
              activePool === pool
                ? 'border-shade-teal/50 bg-shade-teal/10 text-shade-teal'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-shade-teal/20'
            )}
          >
            {pool === 'pool1' ? '⬡ Pool 1 · USDC' : '⬡ Pool 2 · FHE Token'}
          </button>
        ))}
        {activePool === 'pool2' && (
          <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded bg-shade-amber/10 border border-shade-amber/20">
            <Info className="w-3 h-3 text-shade-amber" />
            <span className="text-[10px] text-shade-amber">Pool 2: Enhanced privacy — collateral encrypted</span>
          </div>
        )}
      </div>

      <div className="max-w-[1600px] mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
          {/* Left: Chart + Bottom tabs */}
          <div className="space-y-4">
            <div className="shade-card overflow-hidden">
              <TradingChart />
            </div>

            <Tabs defaultValue="positions" className="shade-card">
              <TabsList className="w-full bg-shade-bg-secondary rounded-none border-b border-border">
                <TabsTrigger value="positions" className="text-xs">My Positions</TabsTrigger>
                <TabsTrigger value="orders" className="text-xs">Orders</TabsTrigger>
                <TabsTrigger value="executions" className="text-xs">Recent Executions</TabsTrigger>
              </TabsList>
              <TabsContent value="positions" className="p-4">
                <PositionPanel />
              </TabsContent>
              <TabsContent value="orders" className="p-4">
                <OrdersTab />
              </TabsContent>
              <TabsContent value="executions" className="p-4">
                <div className="space-y-2">
                  {[
                    { pair: 'ETH-USD', side: 'long', price: 3842.10, size: '0.5 ETH', time: '2 min ago' },
                    { pair: 'BTC-USD', side: 'short', price: 69732.00, size: '0.02 BTC', time: '15 min ago' },
                    { pair: 'ETH-USD', side: 'long', price: 3838.50, size: '1.2 ETH', time: '28 min ago' },
                  ].map((ex, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md text-xs">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-semibold', ex.side === 'long' ? 'text-shade-green' : 'text-shade-red')}>
                          {ex.side.toUpperCase()}
                        </span>
                        <span className="text-foreground">{ex.pair}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono">{ex.size}</span>
                        <span className="font-mono">@ ${ex.price.toLocaleString()}</span>
                        <span className="text-muted-foreground">{ex.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Order Panel */}
          <div>
            <OrderPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useStore } from '@/store/useStore';
import { useMarketData } from '@/hooks/useMarket';
import { useOpenPosition, useCancelOrder, useClosePosition, useTradePrecheck } from '@/hooks/useTrade';
import { usePositions } from '@/hooks/usePositions';
import { useOrders } from '@/hooks/useOrders';
import { useDecryptPosition } from '@/hooks/useDecryptPosition';
import { CONTRACTS, FROM_BLOCK } from '@/lib/contracts';
import { PriceDisplay } from '@/components/shade/PriceDisplay';
import { PrivacyBadge } from '@/components/shade/PrivacyBadge';
import { EncryptedField } from '@/components/shade/EncryptedField';
import { DecryptButton } from '@/components/shade/DecryptButton';
import { PoolBadge } from '@/components/shade/PoolBadge';
import { LeverageSelector } from '@/components/shade/LeverageSelector';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, X as XIcon, Shield, AlertTriangle } from 'lucide-react';
import { createChart, ColorType, CandlestickSeries, HistogramSeries, type IChartApi, type UTCTimestamp } from 'lightweight-charts';
import { parseAbiItem } from 'viem';

// Bridges injected wallet state (wagmi) → Zustand store
// FHE token balances are encrypted — sync only connection state.
function useWalletSync() {
  const { address, isConnected } = useAccount();
  const syncWallet = useStore((s) => s.syncWallet);

  useEffect(() => {
    syncWallet({ connected: isConnected, address: address ?? null });
  }, [isConnected, address, syncWallet]);
}

// --- Chart Component ---
function TradingChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const { market, updateMarket } = useStore();

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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e', downColor: '#ef4444', borderDownColor: '#ef4444', borderUpColor: '#22c55e',
      wickDownColor: '#ef4444', wickUpColor: '#22c55e',
    });

    let priceLineRef: ReturnType<typeof candleSeries.createPriceLine> | null = null;
    let stopped = false;

    // IMPORTANT: CoinGecko blocks browser CORS. Use the dev-server proxy path.
    // In production, you should proxy similarly via your backend/reverse-proxy.
    // Use 1D OHLC (higher resolution) so candles look correct,
    // then "live update" the current 5-minute candle from spot polling.
    // Cached dev endpoints (see vite.config.ts). UI can poll these every 5s safely.
    const COINGECKO_OHLC_1D = '/cg/ohlc';
    const COINGECKO_PRICE = '/cg/price';

    const setOrUpdatePriceLine = (price: number) => {
      if (!Number.isFinite(price) || price <= 0) return;
      if (!priceLineRef) {
        priceLineRef = candleSeries.createPriceLine({
          price,
          color: 'hsl(160, 90%, 43%)',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Mark',
        });
        return;
      }
      // lightweight-charts price line doesn't expose a stable "setPrice" in our typed import;
      // recreate to reflect live price updates.
      candleSeries.removePriceLine(priceLineRef);
      priceLineRef = null;
      setOrUpdatePriceLine(price);
    };

    const candlesRef: { current: { time: UTCTimestamp; open: number; high: number; low: number; close: number }[] } = { current: [] };
    const refreshOhlcHistory = async () => {
      try {
        const r = await fetch(COINGECKO_OHLC_1D, { cache: 'no-store' });
        if (!r.ok) throw new Error(`CoinGecko OHLC HTTP ${r.status}`);
        const data = (await r.json()) as [number, number, number, number, number][];
        const candles = data.map(([ts, o, h, l, c]) => ({
          time: Math.floor(ts / 1000) as UTCTimestamp,
          open: o, high: h, low: l, close: c,
        }));
        if (stopped || candles.length === 0) return;
        candleSeries.setData(candles);
        candlesRef.current = candles;
        chart.timeScale().fitContent();

        // Drive mark/index from the latest candle close (purely from OHLC feed).
        const latest = candles[candles.length - 1];
        setOrUpdatePriceLine(latest.close);
        updateMarket({ markPrice: latest.close, indexPrice: latest.close });
      } catch (e) {
        // best effort: keep last known data
        console.error(e);
      }
    };

    const applySpotToCurrentCandle = (spot: number) => {
      if (!Number.isFinite(spot) || spot <= 0) return;
      const existing = candlesRef.current;
      if (existing.length === 0) return;

      // CoinGecko 1D OHLC comes in 5-minute buckets.
      const now = Math.floor(Date.now() / 1000);
      const bucket = Math.floor(now / 300) * 300;
      const bucketTs = bucket as UTCTimestamp;

      const last = existing[existing.length - 1];
      const lastTs = Number(last.time);

      if (lastTs === Number(bucketTs)) {
        const updated = {
          ...last,
          close: spot,
          high: Math.max(last.high, spot),
          low: Math.min(last.low, spot),
        };
        const next = [...existing.slice(0, -1), updated];
        candlesRef.current = next;
        candleSeries.setData(next);
        return;
      }

      // If we're past the last OHLC bucket, append a new candle seeded from last close.
      if (lastTs < Number(bucketTs)) {
        const nextCandle = { time: bucketTs, open: last.close, high: spot, low: spot, close: spot };
        const next = [...existing, nextCandle].slice(-400);
        candlesRef.current = next;
        candleSeries.setData(next);
      }
    };

    // (No standalone pollLivePrice function) — keep a single polling loop to avoid duplicate requests.

    // Fetch OHLC from CoinGecko public API (ETH/USD, 7 days, hourly).
    // Candles are always sourced from the OHLC feed (no synthetic candle generation).
    refreshOhlcHistory().then(() => scheduleLivePoll(0));

    // Live price line / ticker: update frequently (adaptive backoff on 429).
    let liveTimeout: number | null = null;
    const scheduleLivePoll = (ms: number) => {
      if (liveTimeout != null) window.clearTimeout(liveTimeout);
      liveTimeout = window.setTimeout(async () => {
        try {
          const r = await fetch(COINGECKO_PRICE, { cache: 'no-store' });
          if (r.status === 429) {
            console.warn('[CoinGecko] 429 rate limited; backing off 60s');
            scheduleLivePoll(60_000);
            return;
          }
          if (!r.ok) throw new Error(`CoinGecko price HTTP ${r.status}`);
          const json = (await r.json()) as { ethereum?: { usd?: number; usd_24h_change?: number } };
          const usd = json.ethereum?.usd;
          if (stopped || usd == null) { scheduleLivePoll(5_000); return; }
          setOrUpdatePriceLine(usd);
          updateMarket({
            markPrice: usd,
            indexPrice: usd,
            change24h: json.ethereum?.usd_24h_change != null ? Number(json.ethereum.usd_24h_change.toFixed(2)) : undefined,
          });
          scheduleLivePoll(5_000);
        } catch (err) {
          console.error(err);
          scheduleLivePoll(15_000);
        }
      }, ms);
    };
    scheduleLivePoll(5_000);
    // Real candles: poll OHLC regularly so candles move dynamically.
    const ohlcInterval = window.setInterval(refreshOhlcHistory, 60_000);

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      stopped = true;
      if (liveTimeout != null) window.clearTimeout(liveTimeout);
      window.clearInterval(ohlcInterval);
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [updateMarket]);

  return <div ref={chartRef} className="w-full" />;
}

// --- Ticker Bar ---
function TickerBar() {
  const { market } = useStore();
  const loaded = market.markPrice > 0;
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
          {loaded ? `${market.change24h >= 0 ? '+' : ''}${market.change24h}%` : '—'}
        </span>
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <PrivacyBadge level="DP" />
        <span className="text-xs text-muted-foreground">OI</span>
        <span className="text-xs font-mono text-foreground">
          {loaded && market.openInterest > 0 ? `$${(market.openInterest / 1e9).toFixed(2)}B` : '—'}
        </span>
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <PrivacyBadge level="ZK" />
        <span className="text-xs text-muted-foreground">Funding</span>
        <span className={cn('text-xs font-mono', market.fundingRate >= 0 ? 'text-shade-green' : 'text-shade-red')}>
          {loaded ? `${market.fundingRate >= 0 ? '+' : ''}${market.fundingRate}%` : '—'}
        </span>
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <PrivacyBadge level="ZK" />
        <span className="text-xs text-muted-foreground">Vol</span>
        <span className="text-xs font-mono text-foreground">
          {loaded && market.volume24h > 0 ? `$${(market.volume24h / 1e6).toFixed(1)}M` : '—'}
        </span>
      </div>
      <div className="h-5 w-px bg-border" />
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">TVL</span>
        <span className="text-xs font-mono text-foreground">
          {loaded && market.vaultTVL > 0 ? `$${(market.vaultTVL / 1e6).toFixed(0)}M` : '—'}
        </span>
      </div>
    </div>
  );
}

// --- Order Panel ---
function OrderPanel() {
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [collateral, setCollateral] = useState('');
  const [leverage, setLeverage] = useState(5);
  const [limitPrice, setLimitPrice] = useState('');
  const { wallet, market } = useStore();

  const { execute, status, error, reset } = useOpenPosition();

  // Reset form after confirmed
  useEffect(() => {
    if (status === 'confirmed') {
      setCollateral('');
      setLimitPrice('');
      setTimeout(reset, 3000);
    }
  }, [status, reset]);

  const collateralNum = parseFloat(collateral) || 0;
  const size = collateralNum * leverage;
  const sizeInAsset = market.markPrice > 0 ? (size / market.markPrice) : 0;

  const { warnings, ready: precheckReady } = useTradePrecheck(collateralNum, leverage);

  const isSubmitting = status === 'setting_operator' || status === 'encrypting' || status === 'submitting';
  const buttonLabel = () => {
    if (!wallet.connected) return 'Connect Wallet';
    if (status === 'setting_operator') return 'Setting Operator…';
    if (status === 'encrypting') return 'Encrypting…';
    if (status === 'submitting') return 'Confirming…';
    if (status === 'fhe_decrypt_sent') return 'Awaiting CoFHE decrypt…';
    if (status === 'confirmed') return 'Order Placed!';
    if (status === 'error') return 'Failed — Retry';
    return `${side === 'long' ? 'Long' : 'Short'} ${market.pair}`;
  };

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
        {(['market', 'limit'] as const).map(t => (
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
          <label className="text-xs text-muted-foreground">Limit Price</label>
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
            Balance: <span className="text-shade-teal/70">encrypted</span>
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
            onClick={() => setCollateral(wallet.balanceFHE.toString())}
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
          Maximum privacy: your collateral, position size, entry price, and PnL are all FHE-encrypted on-chain.
        </p>
      </div>

      {/* Pre-flight warnings — shown before MetaMask is opened */}
      {warnings.map((w, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 rounded-md bg-shade-amber/10 border border-shade-amber/20">
          <AlertTriangle className="w-3.5 h-3.5 text-shade-amber mt-0.5 shrink-0" />
          <p className="text-[11px] text-shade-amber leading-relaxed font-mono">{w}</p>
        </div>
      ))}

      {/* Error */}
      {error && (
        <p className="text-xs text-shade-red bg-shade-red/10 border border-shade-red/20 rounded-md px-3 py-2 break-all">
          {error}
        </p>
      )}

      {/* FHE task confirmation notice */}
      {status === 'fhe_decrypt_sent' && (
        <p className="text-xs rounded-md px-3 py-2 border text-shade-amber bg-shade-amber/10 border-shade-amber/20">
          Decrypt task submitted. CoFHE will open your position in ~15-30s.
        </p>
      )}

      {/* CTA */}
      <Button
        onClick={() => execute({
          collateral: collateralNum,
          leverage,
          isLong: side === 'long',
          orderType,
          triggerPrice: limitPrice ? parseFloat(limitPrice) : undefined,
        })}
        className={cn(
          'w-full font-semibold text-sm py-5',
          status === 'confirmed'
            ? 'bg-shade-teal hover:bg-shade-teal/90 text-background'
            : side === 'long'
              ? 'bg-shade-green hover:bg-shade-green/90 text-background'
              : 'bg-shade-red hover:bg-shade-red/90 text-foreground'
        )}
        disabled={!wallet.connected || collateralNum <= 0 || isSubmitting || status === 'fhe_decrypt_sent' || !precheckReady}
      >
        {buttonLabel()}
      </Button>
    </div>
  );
}

// --- Position Panel ---
function PositionPanel() {
  const { positions } = useStore();
  const decryptPosition = useDecryptPosition();
  const { execute: closePosition, status: closeStatus } = useClosePosition();
  // `useClosePosition()` has a single shared `closeStatus` for the whole panel.
  // Track which specific positionKey we clicked so only that row shows "Closing…".
  const [closingPositionKey, setClosingPositionKey] = useState<string | null>(null);

  if (positions.length === 0) {
    return (
      <div className="shade-card p-6 text-center">
        <p className="text-sm text-muted-foreground">No open positions</p>
      </div>
    );
  }

  const collateralLabel = (v: number) => `${v.toFixed(4)} FHE`;
  const notionalLabel   = (v: number) => `${v.toFixed(4)} FHE`;

  return (
    <div className="space-y-3">
      {positions.map((pos) => (
        <div key={pos.id} className="shade-card p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{pos.pair}</span>
              <span className={cn(
                'text-xs font-semibold px-1.5 py-0.5 rounded',
                    pos.status === 'decrypted'
                      ? (pos.side === 'long' ? 'bg-shade-green/15 text-shade-green' : 'bg-shade-red/15 text-shade-red')
                      : 'bg-secondary text-muted-foreground'
              )}>
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

          {/* Plaintext fields from PositionOpened event */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Notional</span>
              <p className="mt-0.5 font-mono text-foreground">
                {pos.size > 0 ? notionalLabel(pos.size) : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Collateral</span>
              <p className="mt-0.5 font-mono text-foreground">
                {pos.collateral > 0 ? collateralLabel(pos.collateral) : '—'}
              </p>
            </div>

            {/* Encrypted fields — revealed only after CoFHE decrypt-for-view */}
            <div>
              <span className="text-muted-foreground">PnL</span>
              <div className="mt-0.5">
                <EncryptedField
                  value={
                    pos.status === 'decrypted'
                      ? `${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)} (${pos.pnlPercent >= 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%)`
                      : '****'
                  }
                  status={pos.status}
                  className={
                    pos.status === 'decrypted' ? (pos.pnl >= 0 ? 'text-shade-green' : 'text-shade-red') : undefined
                  }
                />
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Entry Price</span>
              <div className="mt-0.5">
                <EncryptedField
                  value={pos.status === 'decrypted' ? `$${pos.entryPrice.toLocaleString()}` : '****'}
                  status={pos.status}
                  className="text-foreground"
                />
              </div>
            </div>
          </div>

          {/* Actions — close does not require decryption */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="text-xs flex-1"
              disabled={closeStatus === 'submitting' && closingPositionKey !== null}
              onClick={async () => {
                setClosingPositionKey(pos.positionKey);
                try {
                  await closePosition(pos.positionKey);
                } finally {
                  setClosingPositionKey(null);
                }
              }}
            >
              {closeStatus === 'submitting' && closingPositionKey === pos.positionKey ? 'Closing…' : 'Close Position'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Orders Tab ---
function OrdersTab() {
  const { orders, cancelOrder } = useStore();
  const { execute: cancelOnChain, status: cancelStatus } = useCancelOrder();

  if (orders.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No pending orders</p>;
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => (
        <div key={order.id} className="flex items-center justify-between p-3 bg-secondary/50 rounded-md border border-border">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-muted-foreground">#{order.id}</span>
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
          <button
            onClick={async () => {
              await cancelOnChain(parseInt(order.id));
              cancelOrder(order.id);
            }}
            disabled={cancelStatus === 'submitting'}
            className="p-1 text-muted-foreground hover:text-shade-red disabled:opacity-40"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// --- Trade Page ---
export default function TradePage() {
  const { market } = useStore();
  useWalletSync();
  // Use on-chain reads for funding/OI, but keep mark price driven by CoinGecko chart polling.
  useMarketData({ includePrice: false });
  usePositions();  // reads PositionOpened events + checks exists on-chain
  useOrders();     // reads OrderCreated events + checks isActive on-chain

  // Recent executions: derive from on-chain OrderExecuted logs (no hardcoded rows).
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [executions, setExecutions] = useState<{ orderId: string; blockNumber: bigint; timestampMs: number }[]>([]);

  useEffect(() => {
    if (!address || !publicClient) {
      setExecutions([]);
      return;
    }

    let cancelled = false;
    const omAddress = CONTRACTS.orderManager as `0x${string}`;

    async function fetchRecent() {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > 20_000n
          ? (currentBlock - 20_000n > FROM_BLOCK ? currentBlock - 20_000n : FROM_BLOCK)
          : FROM_BLOCK;

        const logs = await publicClient.getLogs({
          address: omAddress,
          event: parseAbiItem('event OrderExecuted(uint256 indexed orderId, address indexed trader)'),
          args: { trader: address },
          fromBlock,
          toBlock: currentBlock,
        });

        // newest first
        const newest = [...logs].reverse().slice(0, 20);

        const blocks = await Promise.all(newest.map(l => publicClient.getBlock({ blockNumber: l.blockNumber })));
        const rows = newest.map((l, i) => ({
          orderId: l.args.orderId!.toString(),
          blockNumber: l.blockNumber,
          timestampMs: Number(blocks[i]?.timestamp ?? 0n) * 1000,
        }));

        if (!cancelled) setExecutions(rows);
      } catch (e) {
        console.error('[TradePage] fetch executions error:', e);
      }
    }

    fetchRecent();

    const unwatch = publicClient.watchEvent({
      address: omAddress,
      event: parseAbiItem('event OrderExecuted(uint256 indexed orderId, address indexed trader)'),
      args: { trader: address },
      fromBlock: FROM_BLOCK,
      poll: true,
      pollingInterval: 5_000,
      onLogs: () => void fetchRecent(),
    });

    return () => {
      cancelled = true;
      unwatch?.();
    };
  }, [address, publicClient]);

  return (
    <div className="animate-fade-in">
      <TickerBar />

      {/* Pool indicator */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-shade-bg-primary">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-shade-teal/10 border border-shade-teal/20">
          <span className="text-[10px] text-shade-teal font-mono">⬡ FHE Pool · FHE Token / ETH — Maximum Privacy</span>
        </div>
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
                {executions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No executions yet</p>
                ) : (
                  <div className="space-y-2">
                    {executions.map((ex) => (
                      <div key={`${ex.blockNumber.toString()}-${ex.orderId}`} className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-md text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-muted-foreground">Executed</span>
                          <span className="font-mono text-foreground">#{ex.orderId}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-muted-foreground">block {ex.blockNumber.toString()}</span>
                          <span className="text-muted-foreground">
                            {ex.timestampMs > 0 ? new Date(ex.timestampMs).toLocaleString() : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

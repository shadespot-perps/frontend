import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { EncryptedField } from '@/components/shade/EncryptedField';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { TrendingUp, AlertTriangle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  useVaultStats,
  useTokenBalance,
  useAddLiquidity,
  useRemoveLiquidity,
  type VaultTxStatus,
} from '@/hooks/useVault';

function VaultUtilMeter({ value }: { value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Utilisation</span>
        <span className="font-mono text-foreground">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all',
            value < 0.7 ? 'bg-shade-green' : value < 0.9 ? 'bg-shade-amber' : 'bg-shade-red')}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

function TxStatusBar({ status, error, onReset }: { status: VaultTxStatus; error: string | null; onReset: () => void }) {
  if (status === 'idle') return null;

  const messages: Record<VaultTxStatus, string> = {
    idle:              '',
    setting_operator:  'Setting operator permission…',
    encrypting:        'Encrypting inputs…',
    submitting:        'Submitting transaction…',
    submitting_check:  'Submitting withdraw check…',
    awaiting_decrypt:  'Waiting for CoFHE decrypt (~15-30s)…',
    confirmed:         'Transaction confirmed!',
    error:             error ?? 'Transaction failed',
  };

  const isError = status === 'error';
  const isOk    = status === 'confirmed';

  return (
    <div className={cn('flex items-center gap-2 p-3 rounded-md text-xs',
      isOk    ? 'bg-shade-green/10 border border-shade-green/20 text-shade-green' :
      isError ? 'bg-shade-red/10 border border-shade-red/20 text-shade-red' :
                'bg-shade-teal/10 border border-shade-teal/20 text-shade-teal'
    )}>
      {isOk    ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> :
       isError ? <XCircle      className="w-3.5 h-3.5 shrink-0" /> :
                 <Loader2      className="w-3.5 h-3.5 shrink-0 animate-spin" />}
      <span className="flex-1 font-mono">{messages[status]}</span>
      {(isOk || isError) && (
        <button onClick={onReset} className="underline underline-offset-2">dismiss</button>
      )}
    </div>
  );
}

export default function EarnPage() {
  const { isConnected } = useAccount();

  const [tab, setTab]       = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');

  // FHE vault and token balances are always encrypted
  const { tvl, utilization, isEncrypted: statsEncrypted } = useVaultStats();
  const { balance: tokenBalance, isEncrypted: balanceEncrypted } = useTokenBalance();

  const deposit  = useAddLiquidity();
  const { isOperatorSet } = deposit;
  const withdraw = useRemoveLiquidity();

  const active = tab === 'deposit' ? deposit : withdraw;
  const isBusy = active.status !== 'idle' && active.status !== 'confirmed' && active.status !== 'error';

  const balanceLabel = balanceEncrypted
    ? null
    : tokenBalance != null
      ? `${tokenBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} FHE`
      : '—';

  function handleMax() {
    if (!balanceEncrypted && tokenBalance != null) setAmount(tokenBalance.toFixed(6));
  }

  function handleSubmit() {
    if (!amount || parseFloat(amount) <= 0) return;
    if (tab === 'deposit') deposit.execute(amount);
    else withdraw.execute(amount);
  }

  function depositButtonLabel() {
    if (!isConnected) return 'Connect Wallet';
    if (active.status === 'setting_operator') return 'Step 1/2: Approving Operator…';
    if (active.status === 'encrypting')       return 'Step 2/2: Encrypting…';
    if (active.status === 'submitting')       return 'Step 2/2: Depositing…';
    if (active.status === 'confirmed')        return 'Deposited!';
    if (!isOperatorSet) return 'Approve Operator & Deposit';
    return 'Deposit';
  }

  function withdrawButtonLabel() {
    if (!isConnected) return 'Connect Wallet';
    if (active.status === 'submitting_check') return 'Submitting Check…';
    if (active.status === 'awaiting_decrypt') return 'Awaiting CoFHE Decrypt…';
    if (active.status === 'submitting') return 'Withdrawing…';
    if (active.status === 'confirmed') return 'Withdrawn!';
    return 'Withdraw Liquidity';
  }

  return (
    <div className="max-w-[1200px] mx-auto p-4 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Earn</h1>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-shade-teal/10 border border-shade-teal/20">
          <span className="text-[10px] text-shade-teal font-mono">⬡ FHE Pool · FHE Token / ETH</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left */}
        <div className="space-y-4">
          {/* Vault Stats */}
          <div className="shade-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-shade-teal" /> Vault Statistics
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-xs text-muted-foreground">TVL</span>
                <div className="mt-0.5">
                  {statsEncrypted ? (
                    <EncryptedField value="Encrypted" status="encrypted" />
                  ) : tvl != null ? (
                    <p className="text-lg font-mono font-semibold text-foreground">
                      ${tvl >= 1e6 ? `${(tvl / 1e6).toFixed(1)}M` : tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  ) : (
                    <p className="text-lg font-mono font-semibold text-muted-foreground">—</p>
                  )}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">7d APY</span>
                <p className="text-lg font-mono font-semibold text-muted-foreground mt-0.5">—</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">30d APY</span>
                <p className="text-lg font-mono font-semibold text-muted-foreground mt-0.5">—</p>
              </div>
              <div>
                {statsEncrypted ? (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Utilisation</span>
                    <EncryptedField value="Encrypted" status="encrypted" />
                  </div>
                ) : utilization != null ? (
                  <VaultUtilMeter value={utilization} />
                ) : (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Utilisation</span>
                    <p className="text-sm font-mono text-muted-foreground">Loading…</p>
                  </div>
                )}
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
                  <EncryptedField value="Encrypted" status="encrypted" />
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Current APY</span>
                <p className="font-mono text-muted-foreground mt-1">—</p>
              </div>
            </div>
          </div>

          {/* Revenue chart */}
          <div className="shade-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Pool Performance</h2>
            <div className="h-48 flex items-center justify-center border border-border/50 rounded-md bg-shade-bg-secondary">
              <div className="text-center space-y-2 px-6">
                <p className="text-sm text-foreground font-semibold">Coming soon</p>
                <p className="text-xs text-muted-foreground">
                  Pool performance charts will appear once on-chain accounting + analytics are wired.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right — action panel */}
        <div className="space-y-4">
          <div className="shade-card p-5 space-y-4">
            {/* Deposit / Withdraw tabs */}
            <div className="flex gap-1 p-1 bg-secondary rounded-md">
              {(['deposit', 'withdraw'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setAmount(''); active.reset(); }}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-semibold rounded transition-all capitalize',
                    tab === t
                      ? 'bg-shade-bg-primary text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs text-muted-foreground">Amount</label>
                {isConnected && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {balanceEncrypted ? (
                      <EncryptedField value="Balance: encrypted" status="encrypted" />
                    ) : (
                      <>Balance: {balanceLabel ?? '—'}</>
                    )}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={isBusy}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2.5 text-sm font-mono text-foreground placeholder:text-shade-text-muted focus:outline-none focus:border-shade-teal/50 disabled:opacity-50"
                />
                {tab === 'deposit' && !balanceEncrypted && tokenBalance != null && (
                  <button
                    onClick={handleMax}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-shade-teal"
                  >
                    MAX
                  </button>
                )}
              </div>
            </div>

            {/* Preview */}
            {parseFloat(amount) > 0 && tab === 'deposit' && (
              <div className="p-3 bg-secondary/50 rounded-md space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated APY</span>
                  <span className="font-mono text-muted-foreground">—</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Monthly Yield</span>
                  <span className="font-mono text-muted-foreground">—</span>
                </div>
                {!isOperatorSet && (
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-muted-foreground shrink-0">Step 1 of 2</span>
                    <span className="font-mono text-shade-amber text-right leading-tight">
                      Approve the router as operator (one-time, sign in MetaMask)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Status bar */}
            <TxStatusBar status={active.status} error={active.error} onReset={active.reset} />

            {/* CTA */}
            <Button
              className="w-full gradient-teal text-shade-bg-primary font-semibold"
              disabled={!isConnected || !parseFloat(amount) || isBusy}
              onClick={handleSubmit}
            >
              {isBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {tab === 'deposit' ? depositButtonLabel() : withdrawButtonLabel()}
            </Button>
          </div>

          {/* Risk callout */}
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

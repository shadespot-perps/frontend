import { useEffect, useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits, zeroAddress } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  Droplets,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  Link2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getContracts, SUPPORTED_CHAIN_IDS } from '@/lib/contracts';
import { useFaucetMint, useFaucetTokenMeta, usePlainBalance } from '@/hooks/useFaucet';
import { useUnderlyingExtraction, type UnderlyingSource } from '@/hooks/useUnderlyingToken';
import { PageShell } from '@/components/layout/PageShell';
import { InfoPopover } from '@/components/ui/InfoPopover';

const PRESETS = ['1', '5', '10', '18'];

const SOURCE_LABEL: Record<NonNullable<UnderlyingSource>, string> = {
  vault: 'From vault config',
  router: 'From router config',
  faucet_override: 'Manual override (local)',
  env: 'From env (VITE_UNDERLYING_TOKEN)',
};

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function tokenExplorerUrl(chainId: number, addr: string) {
  if (chainId === 421614) return `https://sepolia.arbiscan.io/token/${addr}`;
  if (chainId === 11155111) return `https://sepolia.etherscan.io/token/${addr}`;
  if (chainId === 84532) return `https://sepolia.basescan.org/token/${addr}`;
  return `https://sepolia.arbiscan.io/token/${addr}`;
}

function MintCard({
  title,
  description,
  chainId,
  tokenAddress,
  kind,
  meta,
  plainBalance,
  onMintSuccess,
}: {
  title: string;
  description: string;
  chainId: number;
  tokenAddress: `0x${string}` | null;
  kind: 'fhe' | 'plain';
  meta: { name: string; symbol: string; decimals: number };
  plainBalance?: bigint;
  onMintSuccess?: () => void;
}) {
  const [amount, setAmount] = useState('1000');
  const { mint, status, error, lastTxHash, reset } = useFaucetMint(kind, tokenAddress);

  const busy = status === 'pending' || status === 'confirming';
  const disabled = !tokenAddress || busy;

  useEffect(() => {
    if (status === 'success') onMintSuccess?.();
  }, [status, onMintSuccess]);

  return (
    <div className="shade-card p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Droplets className="w-4 h-4 text-shade-teal" />
          {title}
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>

      <div className="rounded-xl bg-secondary/40 border border-border/70 px-4 py-3 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Token</span>
          <span className="text-foreground font-medium">{meta.name} ({meta.symbol})</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Decimals</span>
          <span className="text-foreground font-mono">{meta.decimals}</span>
        </div>
        <div className="flex justify-between gap-2 items-start">
          <span className="text-muted-foreground shrink-0">Contract</span>
          {tokenAddress ? (
            <a
              href={tokenExplorerUrl(chainId, tokenAddress)}
              target="_blank"
              rel="noreferrer"
              className="text-shade-teal hover:underline break-all text-right font-mono text-[11px]"
            >
              {tokenAddress}
            </a>
          ) : (
            <span className="text-foreground">—</span>
          )}
        </div>
        {kind === 'plain' && plainBalance !== undefined && tokenAddress && (
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Your balance</span>
            <span className="text-foreground">
              {formatUnits(plainBalance, meta.decimals)} {meta.symbol}
            </span>
          </div>
        )}
        {kind === 'fhe' && (
          <p className="text-[10px] text-muted-foreground pt-1">
            Balance is encrypted on-chain — mint increases your confidential balance.
          </p>
        )}
      </div>

      {!tokenAddress ? (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-shade-amber/10 border border-shade-amber/20 text-xs text-shade-amber">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{description}</span>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p}
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-8 rounded-full"
                disabled={disabled}
                onClick={() => setAmount(p)}
              >
                {p} {meta.symbol}
              </Button>
            ))}
            {kind === 'fhe' ? (
              <span className="text-[11px] text-muted-foreground">
                Max single mint ≈ <span className="font-mono text-foreground">18.4467</span>
              </span>
            ) : null}
          </div>

          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="decimal"
              placeholder={`Amount (${meta.symbol})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono rounded-xl"
              disabled={disabled}
            />
            <Button
              type="button"
              className="shrink-0 bg-shade-teal hover:bg-shade-teal/90 text-shade-bg-primary rounded-xl"
              disabled={disabled}
              onClick={() => void mint(amount)}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mint'}
            </Button>
          </div>
        </>
      )}

      {status !== 'idle' && (
        <div
          className={cn(
            'flex items-center gap-2 p-3 rounded-xl text-xs border',
            status === 'success'
              ? 'bg-shade-green/10 border-shade-green/20 text-shade-green'
              : status === 'error'
                ? 'bg-shade-red/10 border-shade-red/20 text-shade-red'
                : 'bg-shade-teal/10 border-shade-teal/20 text-shade-teal',
          )}
        >
          {status === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : status === 'error' ? (
            <XCircle className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
          )}
          <span className="flex-1 font-mono">
            {status === 'pending' && 'Confirm mint in wallet…'}
            {status === 'confirming' && 'Waiting for confirmation…'}
            {status === 'success' && 'Mint confirmed'}
            {status === 'error' && (error ?? 'Mint failed')}
          </span>
          {(status === 'success' || status === 'error') && (
            <button type="button" onClick={reset} className="underline underline-offset-2">
              dismiss
            </button>
          )}
        </div>
      )}

      {lastTxHash && (
        <a
          href={`https://sepolia.arbiscan.io/tx/${lastTxHash}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-shade-teal hover:underline font-mono"
        >
          View on Arbiscan <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function AddressRow({
  label,
  chainId,
  address,
  highlight,
}: {
  label: string;
  chainId: number;
  address: `0x${string}` | null;
  highlight?: boolean;
}) {
  const isZero = !address || address === zeroAddress;
  const display = isZero ? '0x0000…0000 (not set)' : address;

  return (
    <div
      className={cn(
        'flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-start',
        highlight && !isZero && 'text-shade-teal',
      )}
    >
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      {isZero ? (
        <span className="text-foreground font-mono text-[11px]">{display}</span>
      ) : (
        <div className="flex items-center gap-2 sm:justify-end">
          <a
            href={tokenExplorerUrl(chainId, address)}
            target="_blank"
            rel="noreferrer"
            className="text-foreground hover:text-shade-teal font-mono text-[11px] break-all text-right"
          >
            {address}
          </a>
        </div>
      )}
    </div>
  );
}

export default function DevFaucetPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const extraction = useUnderlyingExtraction();
  const [overrideInput, setOverrideInput] = useState(extraction.faucetOverride ?? '');
  const [copied, setCopied] = useState(false);

  const underlyingAddress = extraction.address;
  const fheMeta = useFaucetTokenMeta(contracts.fheToken as `0x${string}`, 'fhe');
  const plainMeta = useFaucetTokenMeta(underlyingAddress, 'plain');
  const { balance: plainBalance, refetch: refetchPlainBalance } = usePlainBalance(underlyingAddress);

  const copyResolved = async () => {
    if (!underlyingAddress) return;
    await navigator.clipboard.writeText(underlyingAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageShell
      title={(
        <span className="inline-flex items-center gap-2">
          Dev faucet
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-shade-amber/15 text-shade-amber border border-shade-amber/25">
            Testnet only
          </span>
        </span>
      )}
      subtitle="Mint encrypted collateral and plain underlying for local testing."
      width="lg"
    >
      <div className="space-y-6">
        <div className="flex items-start gap-2 p-4 rounded-2xl bg-shade-amber/10 border border-shade-amber/20 text-xs text-shade-amber">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Dev-only: unrestricted mint</span>
              <InfoPopover
                label="Why?"
                content={
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This faucet is meant for local testing only. Public mint has no access control, so it
                    should never be used in production.
                  </p>
                }
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground/90">Use at your own risk.</p>
          </div>
        </div>

        {!isConnected ? (
          <div className="shade-card p-10 flex flex-col items-center gap-4 text-center">
            <p className="text-sm text-muted-foreground">
              Connect a wallet on one of: {SUPPORTED_CHAIN_IDS.join(', ')}
            </p>
            <ConnectButton />
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
            <span className="font-mono text-foreground">{shorten(address!)}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="font-mono">chain {chainId}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Extracted protocol tokens */}
          <div className="shade-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Link2 className="w-4 h-4 text-shade-teal" />
                Token configuration
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                disabled={extraction.isLoading}
                onClick={() => extraction.refetch()}
              >
                <RefreshCw className={cn('w-3.5 h-3.5 mr-1', extraction.isLoading && 'animate-spin')} />
                Refresh
              </Button>
            </div>

            <div className="space-y-2">
              <AddressRow label="FHE collateral" chainId={chainId} address={contracts.fheToken as `0x${string}`} />
              <AddressRow label="Vault" chainId={chainId} address={contracts.vault as `0x${string}`} />
              <AddressRow label="Router" chainId={chainId} address={contracts.router as `0x${string}`} />
            </div>

            <div className="border-t border-border/70 pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-foreground">Underlying token (wrap flows)</p>
                {underlyingAddress && extraction.source ? (
                  <span className="text-[11px] text-muted-foreground">{SOURCE_LABEL[extraction.source]}</span>
                ) : null}
              </div>

              {underlyingAddress && extraction.source && (
                <div className="rounded-2xl bg-shade-teal/10 border border-shade-teal/20 px-4 py-3 space-y-2">
                  <div className="flex justify-between items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Used for faucet + wrap</span>
                    <span className="font-mono text-shade-teal">Active</span>
                  </div>
                  <p className="font-mono text-[11px] text-foreground break-all">{underlyingAddress}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-full"
                    onClick={() => void copyResolved()}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    {copied ? 'Copied' : 'Copy address'}
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <AddressRow
                  label="Vault underlying"
                  chainId={chainId}
                  address={extraction.vaultUnderlying}
                  highlight={extraction.source === 'vault'}
                />
                <AddressRow
                  label="Router underlying"
                  chainId={chainId}
                  address={extraction.routerUnderlying}
                  highlight={extraction.source === 'router'}
                />
                <AddressRow
                  label="Configured underlying (VITE_UNDERLYING_TOKEN)"
                  chainId={chainId}
                  address={extraction.envUnderlying}
                  highlight={extraction.source === 'env'}
                />
              </div>

              {!underlyingAddress && (
                <div className="pt-2 space-y-3">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    No underlying found on vault/router yet. Paste a token address below to enable plain mint.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="0x… underlying token"
                      value={overrideInput}
                      onChange={(e) => setOverrideInput(e.target.value)}
                      className="font-mono text-xs rounded-xl"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="shrink-0 text-xs rounded-xl"
                      onClick={() => extraction.setFaucetOverride(overrideInput.trim())}
                    >
                      Use
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mint actions */}
          <div className="space-y-4">
            <MintCard
              title="FHE collateral (MockFHEToken)"
              description="Encrypted collateral for trade, earn, and orders."
              chainId={chainId}
              tokenAddress={contracts.fheToken as `0x${string}`}
              kind="fhe"
              meta={fheMeta}
            />

            <MintCard
              title={`Plain underlying${plainMeta.symbol ? ` (${plainMeta.symbol})` : ''}`}
              description={
                underlyingAddress
                  ? `Mint ${plainMeta.symbol} for wrap flows (Trade/Earn → Wrap).`
                  : 'Set underlying via vault or paste address below to enable plain mint.'
              }
              chainId={chainId}
              tokenAddress={underlyingAddress}
              kind="plain"
              meta={plainMeta}
              plainBalance={plainBalance}
              onMintSuccess={() => void refetchPlainBalance()}
            />

            {underlyingAddress ? (
              <div className="text-xs text-muted-foreground">
                <InfoPopover
                  label={`How to wrap ${plainMeta.symbol || 'underlying'} → FHE`}
                  content={
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Go to <strong>Trade → Wrap</strong> or <strong>Earn → Wrap deposit</strong>. The router pulls this token,
                      calls <code className="font-mono">collateralToken.wrap</code>, and continues in FHE.
                    </p>
                  }
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

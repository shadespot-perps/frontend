import { Shield, Lock, Eye, Network, BarChart3, FileCheck } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const sections = [
  {
    icon: Lock,
    title: 'What Is Encrypted',
    items: [
      { label: 'Position size & direction', encrypted: true },
      { label: 'Entry & liquidation price', encrypted: true },
      { label: 'Unrealised PnL', encrypted: true },
      { label: 'Pool 2: Collateral balance', encrypted: true },
      { label: 'Market pair (e.g. ETH-USD)', encrypted: false },
      { label: 'Mark / index price', encrypted: false },
      { label: 'Aggregate volume (ZK proven)', encrypted: false },
      { label: 'Aggregate OI (DP noised)', encrypted: false },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-[900px] mx-auto p-4 space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6 text-shade-teal" /> Privacy Centre
        </h1>
        <p className="text-sm text-muted-foreground">
          Understand how ShadeSpot protects your trading data using Fully Homomorphic Encryption.
        </p>
      </div>

      {/* What is encrypted */}
      <div className="shade-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Lock className="w-4 h-4 text-shade-teal" /> What Is Encrypted vs. Public
        </h2>
        <div className="grid gap-2">
          {sections[0].items.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
              <span className="text-sm text-foreground">{item.label}</span>
              <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${item.encrypted ? 'bg-shade-teal/15 text-shade-teal' : 'bg-shade-text-muted/15 text-shade-text-muted'}`}>
                {item.encrypted ? '🔒 ENCRYPTED' : '👁 PUBLIC'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* How FHE Works */}
      <div className="shade-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="w-4 h-4 text-shade-teal" /> How FHE Works (Simplified)
        </h2>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Fully Homomorphic Encryption (FHE)</strong> allows computations to be performed
            on encrypted data without ever decrypting it. The protocol can calculate your PnL, check your collateral ratio,
            and trigger liquidations — all while your actual numbers remain hidden.
          </p>
          <div className="grid grid-cols-3 gap-3 py-3">
            <div className="text-center p-3 rounded-md bg-shade-teal/5 border border-shade-teal/10">
              <p className="text-xs text-shade-teal font-mono mb-1">1. Encrypt</p>
              <p className="text-[11px]">You encrypt your order locally before submitting</p>
            </div>
            <div className="text-center p-3 rounded-md bg-shade-teal/5 border border-shade-teal/10">
              <p className="text-xs text-shade-teal font-mono mb-1">2. Compute</p>
              <p className="text-[11px]">Protocol processes your trade on ciphertext</p>
            </div>
            <div className="text-center p-3 rounded-md bg-shade-teal/5 border border-shade-teal/10">
              <p className="text-xs text-shade-teal font-mono mb-1">3. Decrypt</p>
              <p className="text-[11px]">Only you can decrypt results via threshold keys</p>
            </div>
          </div>
        </div>
      </div>

      {/* Selective Disclosure */}
      <div className="shade-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Eye className="w-4 h-4 text-shade-teal" /> Selective Disclosure
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You control who sees your data. Share Permits let you grant time-limited, scoped access
          to specific fields (size only, PnL only, or full position). Recipients can verify the data
          is authentic via on-chain proofs — but only see what you allow.
        </p>
      </div>

      {/* Infrastructure */}
      <div className="shade-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Network className="w-4 h-4 text-shade-teal" /> Infrastructure
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-secondary/50 space-y-1">
            <p className="text-sm font-semibold text-foreground">Fhenix CoFHE</p>
            <p className="text-xs text-muted-foreground">FHE computation layer. Runs encrypted operations on-chain.</p>
          </div>
          <div className="p-3 rounded-md bg-secondary/50 space-y-1">
            <p className="text-sm font-semibold text-foreground">Threshold Network</p>
            <p className="text-xs text-muted-foreground">Decryption requires 2-of-3 threshold signatures. No single party can decrypt.</p>
          </div>
        </div>
      </div>

      {/* Analytics Tradeoff */}
      <div className="shade-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-shade-teal" /> Analytics Trade-off
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          ShadeSpot provides useful market analytics without compromising individual privacy through two complementary techniques:
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-md bg-secondary/50 space-y-1">
            <p className="text-sm font-semibold text-shade-teal">Zero-Knowledge Proofs</p>
            <p className="text-xs text-muted-foreground">Volume and funding rates are proven correct without revealing individual trades.</p>
          </div>
          <div className="p-3 rounded-md bg-secondary/50 space-y-1">
            <p className="text-sm font-semibold text-shade-amber">Differential Privacy</p>
            <p className="text-xs text-muted-foreground">OI and ratios include calibrated noise (ε = 1.0) so individual positions can't be inferred.</p>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="shade-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-shade-teal" /> Security & Audits
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
            <span className="text-sm text-foreground">Smart Contract Audit</span>
            <span className="text-xs text-shade-green font-mono">Pending — Q2 2024</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
            <span className="text-sm text-foreground">FHE Circuit Audit</span>
            <span className="text-xs text-shade-green font-mono">Pending — Q2 2024</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-md bg-secondary/50">
            <span className="text-sm text-foreground">Bug Bounty Program</span>
            <span className="text-xs text-shade-amber font-mono">Coming Soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}

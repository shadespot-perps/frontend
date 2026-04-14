import { useStore } from '@/store/useStore';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Shield, Layers, Eye } from 'lucide-react';

const steps = [
  {
    icon: Shield,
    title: 'Welcome to ShadeSpot',
    description: 'The first privacy-preserving perpetual futures DEX. Your positions, PnL, and trade sizes are encrypted using Fully Homomorphic Encryption (FHE).',
    detail: 'Nobody — not even the protocol — can see your individual trade data.',
  },
  {
    icon: Layers,
    title: 'Two Pools, Your Choice',
    description: 'Pool 1 uses USDC collateral with standard privacy. Pool 2 uses FHE Token collateral with maximum encryption — even your balance is hidden.',
    detail: 'Switch between pools anytime. Each has unique tradeoffs.',
  },
  {
    icon: Eye,
    title: 'Reading the Interface',
    description: 'Blurred values with a 🔒 icon are encrypted. Click "Decrypt" to reveal them with a threshold signature. Badges show privacy method:',
    detail: '⬡ ZK = Zero-Knowledge Proof  •  DP = Differential Privacy  •  PUBLIC = On-chain',
  },
];

export function OnboardingModal() {
  const { showOnboarding, dismissOnboarding } = useStore();
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  if (!showOnboarding) return null;

  const current = steps[step];
  const Icon = current.icon;

  return (
    <Dialog open={showOnboarding} onOpenChange={() => dismissOnboarding()}>
      <DialogContent className="bg-card border-border max-w-md p-0 overflow-hidden">
        {/* Top accent */}
        <div className="h-1 gradient-teal" />

        <div className="p-6 space-y-5">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-shade-teal/10 border border-shade-teal/20 flex items-center justify-center">
            <Icon className="w-6 h-6 text-shade-teal" />
          </div>

          {/* Step indicator */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full flex-1 transition-colors ${
                  i <= step ? 'bg-shade-teal' : 'bg-secondary'
                }`}
              />
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.description}</p>
            <p className="text-xs text-shade-text-muted leading-relaxed font-mono">{current.detail}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            {step === steps.length - 1 ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShow}
                  onChange={(e) => setDontShow(e.target.checked)}
                  className="rounded border-border accent-shade-teal"
                />
                <span className="text-xs text-muted-foreground">Don&apos;t show again</span>
              </label>
            ) : (
              <button onClick={dismissOnboarding} className="text-xs text-muted-foreground hover:text-foreground">
                Skip
              </button>
            )}

            {step < steps.length - 1 ? (
              <Button size="sm" onClick={() => setStep(step + 1)} className="gradient-teal text-shade-bg-primary font-semibold">
                Next
              </Button>
            ) : (
              <Button size="sm" onClick={dismissOnboarding} className="gradient-teal text-shade-bg-primary font-semibold">
                Start Trading
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

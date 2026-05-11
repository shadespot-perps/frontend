import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  BarChart2,
  EyeOff,
  Layers,
  LineChart,
  Lock,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';

const signals = [
  { icon: EyeOff, label: 'Discreet execution' },
  { icon: Shield, label: 'Fair-market rails' },
  { icon: LineChart, label: 'Perpetuals, refined' },
];

const bentoBars = [38, 62, 44, 78, 52, 88, 41, 71, 48, 92, 55, 67];

const heroSparkles = [
  { className: 'left-[12%] top-[18%] h-1.5 w-1.5' },
  { className: 'right-[20%] top-[28%] h-2 w-2' },
  { className: 'left-[22%] bottom-[26%] h-1 w-1' },
  { className: 'right-[14%] bottom-[20%] h-1.5 w-1.5' },
];

function HeroVisual({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[400px] select-none lg:mx-0 lg:max-w-none',
        'h-[220px] sm:h-[260px] lg:h-[min(420px,46vh)]',
        className,
      )}
      aria-hidden
    >
      <div className="absolute left-1/2 top-1/2 h-[min(100%,320px)] w-[min(100%,320px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary/20 bg-primary/[0.04] shadow-[inset_0_0_40px_hsl(160_90%_43%/0.06)] motion-safe:animate-[spin_72s_linear_infinite] motion-reduce:animate-none" />
      <div className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-primary/[0.08] to-transparent blur-2xl motion-safe:animate-landing-orb-pulse motion-reduce:animate-none" />

      {heroSparkles.map((s, i) => (
        <div
          key={i}
          className={cn(
            'absolute rounded-full bg-primary shadow-[0_0_12px_hsl(160_90%_43%/0.45)] motion-safe:animate-pulse-teal motion-reduce:animate-none',
            s.className,
          )}
          style={{ animationDelay: `${i * 0.35}s` }}
        />
      ))}

      <div className="absolute inset-x-4 top-8 sm:inset-x-10 lg:inset-x-2 lg:left-4 lg:right-0 lg:top-14">
        <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card/85 via-card/40 to-background/60 p-4 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)] backdrop-blur-xl motion-safe:animate-landing-float motion-reduce:translate-y-0">
          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[hsl(0_72%_51%/0.65)]" />
              <span className="h-2 w-2 rounded-full bg-[hsl(38_92%_50%/0.55)]" />
              <span className="h-2 w-2 rounded-full bg-[hsl(142_71%_45%/0.45)]" />
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
              <Lock className="h-2.5 w-2.5 text-primary" />
              Book
            </span>
          </div>

          <svg
            className="relative mt-4 h-[72px] w-full overflow-visible sm:h-[84px]"
            viewBox="0 0 280 84"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="heroLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(160 90% 43% / 0.15)" />
                <stop offset="45%" stopColor="hsl(160 90% 43% / 0.75)" />
                <stop offset="100%" stopColor="hsl(160 90% 43% / 0.25)" />
              </linearGradient>
              <linearGradient id="heroFill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(160 90% 43% / 0.2)" />
                <stop offset="100%" stopColor="hsl(160 90% 43% / 0)" />
              </linearGradient>
            </defs>
            <path
              d="M0 62 C 42 62, 56 18, 98 32 S 168 8, 210 24 S 252 44, 280 12"
              stroke="url(#heroLine)"
              strokeWidth="2.25"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M0 62 C 42 62, 56 18, 98 32 S 168 8, 210 24 S 252 44, 280 12 V 84 H 0 Z"
              fill="url(#heroFill)"
              opacity="0.65"
            />
            <circle cx="210" cy="24" r="4" fill="hsl(160 90% 43%)" opacity="0.9" />
            <circle cx="210" cy="24" r="8" stroke="hsl(160 90% 43% / 0.35)" strokeWidth="2" fill="none" />
          </svg>

          <div className="relative mt-3 flex h-11 items-end gap-1">
            {[38, 62, 28, 52, 74, 44, 58, 34].map((pct, i) => (
              <div
                key={i}
                className="min-h-[6px] flex-1 rounded-t-sm border border-primary/15 bg-gradient-to-t from-primary/25 to-primary/5 motion-safe:animate-landing-bar motion-reduce:animate-none"
                style={{
                  height: `${pct}%`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <div className="h-5 flex-1 rounded-md bg-muted/30 blur-[3px]" />
            <div className="h-5 w-20 shrink-0 rounded-md bg-primary/15" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-2 right-1 flex items-center gap-2 rounded-xl border border-primary/25 bg-background/80 px-3 py-2 shadow-lg backdrop-blur-md motion-safe:animate-landing-sparkle motion-reduce:translate-y-0 sm:bottom-4 sm:right-2 lg:bottom-8 lg:right-4">
        <EyeOff className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Masked size
        </span>
      </div>
    </div>
  );
}

const flow = [
  {
    step: '01',
    title: 'Connect & fund',
    line: 'Wallet in, collateral ready, same rhythm as any professional venue.',
  },
  {
    step: '02',
    title: 'Size in silence',
    line: 'Your book stays off the marquee while the market does its thing.',
  },
  {
    step: '03',
    title: 'Exit on your terms',
    line: 'Close or prove performance without handing rivals a playbook.',
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 right-[-10%] h-[min(520px,80vw)] w-[min(520px,80vw)] rounded-full bg-primary/[0.07] blur-[120px] motion-safe:animate-landing-float motion-reduce:animate-none" />
        <div className="absolute bottom-0 left-[-5%] h-[280px] w-[280px] rounded-full bg-primary/[0.05] blur-[100px] motion-safe:animate-landing-float-alt motion-reduce:animate-none" />
        <div
          className="absolute inset-[-20%] opacity-[0.35] motion-safe:animate-landing-grid-drift motion-reduce:animate-none"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--border) / 0.45) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--border) / 0.45) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 70% 55% at 50% 35%, black 20%, transparent 70%)',
          }}
        />
      </div>

      <header className="relative z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl motion-safe:animate-landing-fade-up motion-reduce:opacity-100">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="group flex items-center gap-2 transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <img
              src="/shadespot_logo.jpeg"
              alt="ShadeSpot"
              className="h-8 w-8 rounded-md object-contain bg-secondary ring-1 ring-border transition-[box-shadow] duration-300 group-hover:shadow-[0_0_20px_hsl(160_90%_43%/0.25)]"
            />
            <span className="text-sm font-semibold tracking-tight transition-colors duration-300 group-hover:text-primary">
              ShadeSpot
            </span>
          </Link>
          <Button
            size="sm"
            className="group gap-1.5 rounded-full px-5 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_24px_hsl(160_90%_43%/0.35)] active:scale-[0.97]"
            asChild
          >
            <Link to="/trade">
              Open app
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        {/* Hero */}
        <section className="flex flex-1 flex-col justify-center px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-16">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-6 xl:gap-10">
            <div className="lg:col-span-6 xl:col-span-5">
              <h1 className="isolate max-w-full text-balance text-[clamp(2.25rem,6vw,3.75rem)] font-semibold leading-[1.18] tracking-tight sm:leading-[1.14] motion-safe:animate-landing-fade-up motion-reduce:opacity-100">
                <span className="block">Perpetuals</span>
                <span
                  className={cn(
                    'mt-[0.06em] block bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text',
                    '[-webkit-background-clip:text] [-webkit-text-fill-color:transparent]',
                    'pb-[0.14em] text-transparent',
                    'bg-[length:200%_auto] motion-safe:animate-landing-gradient-text motion-reduce:animate-none',
                  )}
                >
                  without the spotlight.
                </span>
              </h1>
              <div className="mt-6 lg:hidden">
                <HeroVisual className="motion-safe:animate-landing-fade-up motion-safe:delay-75 motion-reduce:opacity-100" />
              </div>
              <p
                className={cn(
                  'mt-6 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base lg:mt-8',
                  'motion-safe:animate-landing-fade-up motion-safe:delay-100 motion-reduce:opacity-100',
                )}
              >
                Built for desks that want clean execution, not a running commentary on their book.
              </p>
              <div
                className={cn(
                  'mt-10 flex flex-wrap items-center gap-3',
                  'motion-safe:animate-landing-fade-up motion-safe:delay-200 motion-reduce:opacity-100',
                )}
              >
                <Button
                  size="lg"
                  className="group h-12 rounded-full px-8 transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_0_32px_hsl(160_90%_43%/0.35)] active:scale-[0.97]"
                  asChild
                >
                  <Link to="/trade">
                    Start trading
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-12 rounded-full text-muted-foreground transition-all duration-300 hover:bg-accent/80 hover:text-foreground"
                  asChild
                >
                  <Link to="/analytics">Analytics</Link>
                </Button>
              </div>
            </div>
            <div className="relative hidden lg:col-span-6 lg:block xl:col-span-7">
              <div className="motion-safe:animate-landing-fade-up motion-safe:delay-150 motion-reduce:opacity-100">
                <HeroVisual />
              </div>
            </div>
          </div>
        </section>

        {/* Signal strip */}
        <section className="border-t border-border/80 bg-muted/[0.15] backdrop-blur-sm">
          <div className="mx-auto grid max-w-5xl grid-cols-1 divide-y divide-border/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {signals.map(({ icon: Icon, label }, i) => (
              <div
                key={label}
                className={cn(
                  'group flex items-center justify-center gap-3 px-6 py-8 sm:flex-col sm:gap-4 sm:py-12',
                  'transition-colors duration-300 hover:bg-primary/[0.04]',
                  'motion-safe:animate-landing-fade-up motion-reduce:opacity-100',
                )}
                style={{ animationDelay: `${150 + i * 90}ms` }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background/50 text-primary shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:border-primary/40 group-hover:shadow-[0_0_20px_hsl(160_90%_43%/0.2)]">
                  <Icon className="h-[18px] w-[18px] stroke-[1.5] transition-transform duration-500 group-hover:rotate-12" />
                </span>
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground transition-colors duration-300 hover:text-foreground">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Bento */}
        <section className="border-t border-border/80 px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary motion-safe:animate-landing-fade-up motion-reduce:opacity-100">
              Surface
            </p>
            <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight motion-safe:animate-landing-fade-up motion-safe:delay-75 motion-reduce:opacity-100 sm:text-3xl">
              A desk that feels expensive, without the noise.
            </h2>
            <div className="mt-10 grid gap-3 sm:gap-4 md:grid-cols-12">
              <div className="group relative min-h-[220px] overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card/90 via-background to-background p-6 shadow-[0_0_0_1px_hsl(var(--border)/0.5)] transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_0_48px_-12px_hsl(160_90%_43%/0.4)] md:col-span-7 md:min-h-[280px] md:p-8 motion-safe:animate-landing-fade-up motion-safe:delay-100 motion-reduce:opacity-100">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_100%,hsl(160_90%_43%/0.14),transparent_55%)] motion-safe:animate-landing-orb-pulse motion-reduce:animate-none" />
                <div className="relative flex h-full flex-col justify-between">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur-sm transition-all duration-300 group-hover:border-primary/30 group-hover:text-foreground">
                      <BarChart2 className="h-3 w-3 text-primary motion-safe:animate-pulse-teal motion-reduce:animate-none" />
                      Live posture
                    </span>
                    <h3 className="mt-5 text-lg font-semibold tracking-tight transition-colors duration-300 group-hover:text-primary/95 sm:text-xl">
                      Read the tape, blur the rest.
                    </h3>
                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                      Signals stay legible; your size does not.
                    </p>
                  </div>
                  <div className="mt-8 flex h-20 origin-bottom items-end justify-end gap-1 sm:h-24">
                    {bentoBars.map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded-t-sm bg-primary/25 transition-all duration-300 group-hover:bg-primary/55 sm:w-2 motion-safe:animate-landing-bar motion-reduce:animate-none"
                        style={{
                          height: `${h}%`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:gap-4 md:col-span-5">
                <div className="flex flex-1 flex-col justify-between rounded-2xl border border-border/80 bg-muted/[0.12] p-6 transition-all duration-500 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-muted/[0.2] hover:shadow-[0_12px_40px_-24px_hsl(160_90%_43%/0.25)] motion-safe:animate-landing-fade-up motion-safe:delay-150 motion-reduce:opacity-100">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background/50 text-primary transition-transform duration-500 hover:rotate-[-4deg] hover:scale-105">
                    <Layers className="h-5 w-5 stroke-[1.5]" />
                  </div>
                  <div className="mt-6">
                    <h3 className="font-semibold tracking-tight">Two pools, one workflow</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Standard or maximum discretion. Switch when your mandate shifts.
                    </p>
                    <Link
                      to="/earn"
                      className="group mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary transition-all duration-300 hover:gap-2 hover:underline"
                    >
                      Explore earn
                      <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between rounded-2xl border border-border/80 bg-muted/[0.12] p-6 transition-all duration-500 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-muted/[0.2] hover:shadow-[0_12px_40px_-24px_hsl(160_90%_43%/0.25)] motion-safe:animate-landing-fade-up motion-safe:delay-200 motion-reduce:opacity-100">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-background/50 text-primary transition-transform duration-500 hover:rotate-[4deg] hover:scale-105">
                    <Zap className="h-5 w-5 stroke-[1.5]" />
                  </div>
                  <div className="mt-6">
                    <h3 className="font-semibold tracking-tight">Built for velocity</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      Familiar perp flows, tuned for operators who move fast.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Flow */}
        <section className="border-t border-border/80 bg-muted/[0.08] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
              <div className="motion-safe:animate-landing-fade-up motion-reduce:opacity-100">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">Rhythm</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">From wire to unwind</h2>
              </div>
              <p className="max-w-xs text-sm text-muted-foreground motion-safe:animate-landing-fade-up motion-safe:delay-100 motion-reduce:opacity-100">
                Three beats. No handbook required.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              {flow.map(({ step, title, line }, i) => (
                <div
                  key={step}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border border-border/70 bg-background/40 p-6 backdrop-blur-sm',
                    'transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_20px_50px_-30px_hsl(160_90%_43%/0.2)]',
                    'motion-safe:animate-landing-fade-up motion-reduce:opacity-100',
                  )}
                  style={{ animationDelay: `${200 + i * 100}ms` }}
                >
                  <span className="font-mono text-4xl font-semibold tabular-nums text-primary/[0.18] transition-all duration-500 group-hover:scale-105 group-hover:text-primary/35">
                    {step}
                  </span>
                  <h3 className="mt-4 font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{line}</p>
                  <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/[0.06] blur-2xl transition-opacity duration-500 group-hover:opacity-100 motion-safe:animate-landing-orb-pulse motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-16 sm:px-6 sm:py-24">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-b from-primary/[0.09] via-background to-background px-6 py-14 text-center shadow-[0_0_80px_-30px_hsl(160_90%_43%/0.35)] transition-all duration-500 hover:border-primary/40 hover:shadow-[0_0_100px_-24px_hsl(160_90%_43%/0.45)] sm:px-12 sm:py-16 motion-safe:animate-landing-fade-up motion-safe:delay-100 motion-reduce:opacity-100">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
              <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-primary/12 to-transparent motion-safe:animate-landing-shimmer motion-reduce:animate-none" />
            </div>
            <div className="pointer-events-none absolute -left-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl motion-safe:animate-landing-cta-glow motion-reduce:animate-none" />
            <div
              className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-primary/5 blur-3xl motion-safe:animate-landing-cta-glow motion-reduce:animate-none"
              style={{ animationDelay: '1.2s' }}
            />
            <Sparkles className="relative mx-auto h-8 w-8 text-primary/90 motion-safe:animate-landing-sparkle motion-reduce:animate-none" />
            <h2 className="relative mx-auto mt-5 max-w-md text-2xl font-semibold tracking-tight sm:text-3xl">
              Claim your lane on the floor.
            </h2>
            <p className="relative mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
              Same venue. Sharper posture.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                className="h-12 rounded-full px-8 shadow-[0_0_28px_hsl(160_90%_43%/0.25)] transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_0_40px_hsl(160_90%_43%/0.4)] active:scale-[0.98]"
                asChild
              >
                <Link to="/trade">
                  Open ShadeSpot
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-border/80 bg-background/50 transition-all duration-300 hover:border-primary/30 hover:bg-background/80"
                asChild
              >
                <Link to="/positions">Positions</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border px-4 py-6 sm:px-6 motion-safe:animate-landing-fade-up motion-safe:delay-150 motion-reduce:opacity-100">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <span className="flex items-center gap-2">
            <span className="text-primary motion-safe:animate-pulse-teal motion-reduce:animate-none">⬡</span>©{' '}
            {new Date().getFullYear()} ShadeSpot
          </span>
          <div className="flex gap-6">
            <Link
              to="/trade"
              className="transition-all duration-300 hover:text-foreground hover:underline underline-offset-4"
            >
              Trade
            </Link>
            <Link
              to="/earn"
              className="transition-all duration-300 hover:text-foreground hover:underline underline-offset-4"
            >
              Earn
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

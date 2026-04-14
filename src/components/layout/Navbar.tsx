import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/button';
import { Wallet, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { to: '/trade', label: 'Trade' },
  { to: '/positions', label: 'Positions' },
  { to: '/earn', label: 'Earn' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/govern', label: 'Governance' },
  { to: '/privacy', label: 'Privacy' },
];

export function Navbar() {
  const { pathname } = useLocation();
  const { wallet, connectWallet, disconnectWallet } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-shade-bg-primary/95 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4 max-w-[1600px] mx-auto">
        {/* Logo */}
        <Link to="/trade" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md gradient-teal flex items-center justify-center">
            <span className="text-sm font-bold text-shade-bg-primary">S</span>
          </div>
          <span className="font-semibold text-foreground tracking-tight hidden sm:block">ShadeSpot</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                pathname.startsWith(to)
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* FHE Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-shade-teal/10 border border-shade-teal/20">
            <span className="text-shade-teal text-xs">⬡</span>
            <span className="text-[11px] font-mono text-shade-teal">FHE Active</span>
          </div>

          {/* Network */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary">
            <div className="w-1.5 h-1.5 rounded-full bg-shade-green" />
            <span className="text-[11px] text-muted-foreground">Fhenix</span>
          </div>

          {/* Wallet */}
          {wallet.connected ? (
            <Button
              variant="outline"
              size="sm"
              onClick={disconnectWallet}
              className="font-mono text-xs border-border"
            >
              <Wallet className="w-3.5 h-3.5 mr-1.5 text-shade-teal" />
              {wallet.address}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={connectWallet}
              className="gradient-teal text-shade-bg-primary font-semibold text-xs hover:opacity-90"
            >
              Connect Wallet
            </Button>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-1.5 text-muted-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border px-4 py-3 space-y-1 bg-shade-bg-primary">
          {navItems.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'block px-3 py-2 text-sm rounded-md transition-colors',
                pathname.startsWith(to)
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}

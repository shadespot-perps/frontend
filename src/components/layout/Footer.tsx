import { ExternalLink } from 'lucide-react';

const links = [
  { label: 'Docs', href: '#' },
  { label: 'Github', href: '#' },
  { label: 'Audit', href: '#' },
  { label: 'Status', href: '#' },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-shade-bg-primary px-4 py-4">
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-shade-teal">⬡</span>
          <span>ShadeSpot — Privacy-First Perpetual Futures</span>
        </div>
        <div className="flex items-center gap-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              {l.label}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

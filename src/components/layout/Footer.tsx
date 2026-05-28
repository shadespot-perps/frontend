import { ExternalLink } from 'lucide-react';

const links = [
  { label: 'Docs', href: '#' },
  { label: 'Github', href: '#' },
  { label: 'Audit', href: '#' },
  { label: 'Status', href: '#' },
];

export function Footer() {
  const activeLinks = links.filter((l) => l.href && l.href !== '#');

  return (
    <footer className="border-t border-border bg-shade-bg-primary px-4 py-4">
      <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-shade-teal">⬡</span>
          <span>ShadeSpot — Privacy-First Perpetual Futures</span>
        </div>
        {activeLinks.length > 0 ? (
          <div className="flex items-center gap-4">
            {activeLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                {l.label}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </footer>
  );
}

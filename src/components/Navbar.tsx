import { Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavbarProps {
  mode: 'landing' | 'analysis';
  onNavigateHome: () => void;
  onPrimaryAction: () => void;
}

export function Navbar({ mode, onNavigateHome, onPrimaryAction }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks =
    mode === 'landing'
      ? [
          { label: 'Workspace', href: '#analyzer' },
          { label: 'Score History', href: '#score-history' },
          { label: 'Scoring Model', href: '#scoring-model' },
          { label: 'FAQ', href: '#faq' },
        ]
      : [
          { label: 'New Scan', href: '#top' },
          { label: 'Overview', href: '#workspace-main' },
          { label: 'History', href: '#score-history' },
          { label: 'Guide', href: '#disclaimer' },
        ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/90 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="font-display text-lg font-bold tracking-tight text-zinc-100 whitespace-nowrap shrink-0 hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-sm"
        >
          ATS Resume Analyzer
        </button>

        {/* Zone 2: 4 single-line text nav links */}
        {mode === 'landing' ? (
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap shrink-0 hover:text-zinc-100 hover:underline underline-offset-4 decoration-emerald-500/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-sm"
              >
                {link.label}
              </a>
            ))}
          </nav>
        ) : (
          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 whitespace-nowrap">
            <span>Diagnostic Studio</span>
            <span aria-hidden="true">/</span>
            <span className="text-zinc-200 font-medium">Active Report</span>
          </div>
        )}

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            {mode === 'landing' ? 'Analyze Resume' : 'Analyze Another Resume'}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="inline-flex md:hidden items-center justify-center rounded-lg border border-zinc-800 p-2 text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
            {mode === 'landing' &&
              navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                >
                  {link.label}
                </a>
              ))}
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onPrimaryAction();
              }}
              className="mt-1 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              {mode === 'landing' ? 'Analyze Resume' : 'Analyze Another Resume'}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

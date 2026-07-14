import { useEffect, useState } from 'react';
import { Container, PrimaryButton } from './primitives.jsx';
import { NAV_LINKS, CHROME_STORE_URL, GITHUB_URL } from '../lib/constants.js';
import { useSmoothScroll } from '../providers/SmoothScrollProvider.jsx';
import { cn } from '../lib/utils.js';

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollTo } = useSmoothScroll();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const go = (e, href) => {
    e.preventDefault();
    setOpen(false);
    scrollTo(href);
  };

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-200',
        scrolled ? 'border-b border-surface-border bg-surface-bg/80 backdrop-blur-md' : 'border-b border-transparent'
      )}
    >
      <Container className="flex h-16 items-center justify-between">
        <a href="#hero" onClick={(e) => go(e, '#hero')} className="flex items-center gap-2">
          <img src="/chameleon.png" alt="Impleo" className="h-7 w-7" width="28" height="28" />
          <span className="text-[18px] font-semibold tracking-tight text-ink-primary">Impleo</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={(e) => go(e, href)}
              className="text-[14px] font-medium text-ink-secondary transition duration-150 hover:text-ink-primary"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href={GITHUB_URL}
            className="text-[14px] font-medium text-ink-secondary transition duration-150 hover:text-ink-primary"
          >
            GitHub
          </a>
          <PrimaryButton href={CHROME_STORE_URL} className="px-4 py-2 text-[14px]">
            Add to Chrome
          </PrimaryButton>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-btn border border-surface-border p-2 text-ink-primary md:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" fill="none" strokeWidth="1.8" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </Container>

      {open && (
        <div className="border-t border-surface-border bg-surface-sidebar md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={(e) => go(e, href)}
                className="rounded-btn px-2 py-2 text-[15px] text-ink-secondary hover:bg-surface-card-hover hover:text-ink-primary"
              >
                {label}
              </a>
            ))}
            <PrimaryButton href={CHROME_STORE_URL} className="mt-2">
              Add to Chrome — Free
            </PrimaryButton>
          </Container>
        </div>
      )}
    </header>
  );
}

import { Container } from './primitives.jsx';
import { Icon } from './Icon.jsx';
import {
  GITHUB_URL,
  GITHUB_ISSUES_URL,
  INSTALL_GUIDE_URL,
  CONTRIBUTING_URL,
} from '../lib/constants.js';

const COLS = [
  [
    'Product',
    [
      ['How it works', '#extraction'],
      ['Review', '#review'],
      ['Privacy', '#privacy'],
      ['Models', '#providers'],
      ['Q&A', '#faq'],
    ],
  ],
  [
    'Open source',
    [
      ['GitHub', GITHUB_URL],
      ['Install guide', INSTALL_GUIDE_URL],
      ['Contribute', '#contribute'],
      ['Report an issue', GITHUB_ISSUES_URL],
    ],
  ],
  [
    'Get Impleo',
    [
      ['Run it locally', '#cta'],
      ['Contributing rules', CONTRIBUTING_URL],
    ],
  ],
];

export default function Footer() {
  return (
    <footer className="relative bg-jungle">
      <Container className="grid grid-cols-2 gap-8 py-14 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <img src="/chameleon.png" alt="Impleo" className="h-7 w-7" width="28" height="28" />
            <span className="text-[18px] font-semibold text-ink-primary">Impleo</span>
          </div>
          <p className="mt-3 max-w-[24ch] text-[13px] leading-relaxed text-ink-secondary">
            AI autofill for application forms — you stay in control.
          </p>

          {/* Store status, stated plainly rather than implied by a dead link. */}
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-signature/25 bg-signature/10 px-2.5 py-1 text-[11px] font-medium text-signature">
            <Icon name="sprout" className="h-3 w-3" />
            Chrome Web Store — coming soon
          </p>
        </div>

        {COLS.map(([title, links]) => (
          <div key={title}>
            <h4 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">
              {title}
            </h4>
            <ul className="mt-4 space-y-2">
              {links.map(([label, href]) => {
                // In-page anchors stay in the tab; everything else leaves it.
                const external = href.startsWith('http');
                return (
                  <li key={label}>
                    <a
                      href={href}
                      {...(external && { target: '_blank', rel: 'noreferrer' })}
                      className="text-[14px] text-ink-secondary/80 transition duration-150 hover:text-ink-primary"
                    >
                      {label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-white/5">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 sm:flex-row">
          <p className="text-[12px] text-ink-muted">
            © {new Date().getFullYear()} Impleo. MIT licensed · Local-first, single-user.
          </p>
          <div className="flex items-center gap-4">
            <p className="text-[12px] text-ink-muted">Never auto-submits. Ever.</p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Impleo on GitHub"
              className="text-ink-muted transition duration-150 hover:text-ink-primary"
            >
              <Icon name="github" className="h-4 w-4" />
            </a>
          </div>
        </Container>
      </div>
    </footer>
  );
}

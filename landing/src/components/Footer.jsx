import { Container } from './primitives.jsx';
import { CHROME_STORE_URL, GITHUB_URL } from '../lib/constants.js';

const COLS = [
  ['Product', [['How it works', '#extraction'], ['Review', '#review'], ['Privacy', '#privacy']]],
  ['Resources', [['Models', '#providers'], ['GitHub', GITHUB_URL]]],
  ['Get Impleo', [['Add to Chrome', CHROME_STORE_URL]]],
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
        </div>
        {COLS.map(([title, links]) => (
          <div key={title}>
            <h4 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-secondary">
              {title}
            </h4>
            <ul className="mt-4 space-y-2">
              {links.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-[14px] text-ink-secondary/80 transition duration-150 hover:text-ink-primary"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <div className="border-t border-white/5">
        <Container className="flex flex-col items-center justify-between gap-2 py-6 sm:flex-row">
          <p className="text-[12px] text-ink-muted">
            © {new Date().getFullYear()} Impleo. Local-first, single-user.
          </p>
          <p className="text-[12px] text-ink-muted">Never auto-submits. Ever.</p>
        </Container>
      </div>
    </footer>
  );
}

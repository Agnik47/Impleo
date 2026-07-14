import { useRef, useState } from 'react';
import { Container, Section, Heading, Lead, Eyebrow } from '../components/primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { revealChildren } from '../animations/storyReveal.js';
import { PROVIDERS } from '../lib/constants.js';
import { cn } from '../lib/utils.js';

/*
 * Beat 7 — Provider Selection.
 *
 * "One active model at a time" is a rule you can just demonstrate, so this beat
 * is the one interactive moment on the page: pick a provider and watch exactly
 * one go active. It mirrors the real Settings behaviour.
 *
 * Because it's a genuine single-choice control it's built as a real radiogroup
 * (role, aria-checked, roving tabindex, arrow keys) rather than clickable divs
 * — a mouse-only widget here would be a lie about a control users will meet in
 * the product.
 */
export default function ProviderSelection() {
  const [active, setActive] = useState(0);
  const refs = useRef([]);

  const onKeyDown = (e) => {
    const last = PROVIDERS.length - 1;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = active === last ? 0 : active + 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = active === 0 ? last : active - 1;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };

  const scope = useGsap((gsap, el) => {
    revealChildren(gsap, el);
  });

  useMascotSection(scope, 'filling');

  return (
    <Section ref={scope} id="providers" className="border-t border-surface-border py-28 md:py-36">
      <Container className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <div data-reveal>
            <Eyebrow>Multi-model</Eyebrow>
          </div>
          <Heading data-reveal className="mt-4">
            One active model at a time. Your key, never ours.
          </Heading>
          <Lead data-reveal className="mt-5">
            Pick your provider and paste your own key. Impleo routes every call through
            the local server — the key never leaves your machine, and is never handed to
            the browser.
          </Lead>
          <p data-reveal className="mt-6 text-[13px] text-ink-muted">
            Try it: pick one.
          </p>
        </div>

        <div
          data-reveal
          data-reveal-x="24"
          role="radiogroup"
          aria-label="Model provider"
          onKeyDown={onKeyDown}
          className="grid grid-cols-2 gap-4"
        >
          {PROVIDERS.map((name, i) => {
            const isActive = active === i;
            return (
              <button
                key={name}
                ref={(node) => {
                  refs.current[i] = node;
                }}
                type="button"
                role="radio"
                aria-checked={isActive}
                // Roving tabindex: the group is one tab stop; arrows move within.
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn(
                  'flex min-h-[104px] flex-col items-start justify-between rounded-card border p-5 text-left outline-none transition-colors duration-200 ease-premium',
                  'focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg',
                  isActive
                    ? 'border-brand bg-surface-card-hover'
                    : 'border-surface-border bg-surface-card hover:bg-surface-card-hover'
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-input transition-colors duration-200',
                    isActive ? 'bg-brand/15 text-brand' : 'bg-jungle text-ink-muted'
                  )}
                >
                  <Icon name="model" className="h-4 w-4" />
                </span>
                <span className="mt-4 flex w-full items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-ink-primary">{name}</span>
                  {/* The active pill replaces the dot rather than sitting next
                      to it, so exactly one card ever reads as "on". */}
                  <span
                    className={cn(
                      'rounded-full text-[11px] font-semibold transition-colors duration-200',
                      isActive
                        ? 'bg-brand/15 px-2 py-0.5 text-brand'
                        : 'h-1.5 w-1.5 bg-surface-border'
                    )}
                  >
                    {isActive ? 'active' : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

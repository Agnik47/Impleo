import { useState } from 'react';
import { Container, Section, Heading, Eyebrow, PrimaryButton, GhostButton } from '../components/primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { useSmoothScroll } from '../providers/SmoothScrollProvider.jsx';
import { revealChildren } from '../animations/storyReveal.js';
import { FAQ, CHROME_STORE_URL, TRUST_TRIAD } from '../lib/constants.js';
import { cn } from '../lib/utils.js';

/*
 * Beat 9 — CTA.
 *
 * The FAQ lives here rather than in a section of its own: the story brief lists
 * nine beats and none of them is "FAQ", but these are the objections a reader
 * raises in the last few seconds before installing (does it submit for me? do I
 * need a key? where does my data go?). Answering them immediately above the
 * button is where they do work — and it keeps the story spine at nine beats.
 */
export default function FinalCTA() {
  const [open, setOpen] = useState(0);
  const { scrollTo } = useSmoothScroll();

  const scope = useGsap((gsap, el) => {
    revealChildren(gsap, el);
  });

  useMascotSection(scope, 'celebrating');

  return (
    <Section ref={scope} id="cta" className="border-t border-surface-border py-28 md:py-32">
      <Container>
        <div className="mx-auto max-w-[720px]">
          {/* One [data-reveal] on the wrapper, not on both wrapper and child —
              nesting them would transform the heading twice. */}
          <div data-reveal className="text-center">
            <Eyebrow>Before you go</Eyebrow>
            <Heading className="mt-4">Questions, answered.</Heading>
          </div>

          <div className="mt-10 divide-y divide-surface-border border-y border-surface-border">
            {FAQ.map(([q, a], i) => {
              const isOpen = open === i;
              return (
                <div key={q} data-reveal>
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? -1 : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${i}`}
                      id={`faq-trigger-${i}`}
                      className="flex w-full items-center justify-between gap-4 rounded-btn py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-lime"
                    >
                      <span className="text-[16px] font-medium text-ink-primary">{q}</span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'shrink-0 text-ink-secondary transition-transform duration-200 ease-premium',
                          isOpen && 'rotate-180'
                        )}
                      >
                        <Icon name="chevron" className="h-5 w-5" />
                      </span>
                    </button>
                  </h3>
                  {/* Unmounted rather than hidden: keeps it out of the a11y tree
                      and off the tab order when closed. */}
                  {isOpen && (
                    <p
                      id={`faq-panel-${i}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${i}`}
                      className="pb-5 pr-8 text-[15px] leading-relaxed text-ink-secondary"
                    >
                      {a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* The ask. */}
        <div
          data-reveal
          className="relative mt-20 overflow-hidden rounded-card border border-surface-border bg-surface-card px-6 py-16 text-center"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-lime/15 blur-3xl animate-glow-pulse"
          />
          <Heading as="h2" className="relative">
            Stop hand-copying essays.
            <br />
            <span className="chameleon-text">Start applying.</span>
          </Heading>

          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <PrimaryButton href={CHROME_STORE_URL}>Add to Chrome — Free</PrimaryButton>
            <GhostButton
              href="#extraction"
              onClick={(e) => {
                e.preventDefault();
                scrollTo('#extraction');
              }}
            >
              See how it works
            </GhostButton>
          </div>
          <p className="relative mt-5 text-[13px] text-ink-muted">{TRUST_TRIAD}</p>
        </div>
      </Container>
    </Section>
  );
}

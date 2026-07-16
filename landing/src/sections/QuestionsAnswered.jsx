import { useState } from 'react';
import { Container, Section, Heading, Eyebrow } from '../components/primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { revealChildren } from '../animations/storyReveal.js';
import { FAQ } from '../lib/constants.js';
import { cn } from '../lib/utils.js';

/*
 * Q&A.
 *
 * These are the objections a reader raises in the last few seconds before
 * installing (does it submit for me? do I need a key? where does my data go?),
 * so they sit immediately before the ask, where they do their work.
 *
 * It was originally folded inside FinalCTA to keep the story spine at nine
 * beats. It's now its own section for two reasons that need a section to work
 * at all: a nav entry needs a scroll anchor, and the mascot's expression is
 * driven per-section by useMascotSection — a nested block can't hold its own
 * pose. The chameleon spends this beat 'questioning' rather than 'celebrating'
 * through it.
 */
export default function QuestionsAnswered() {
  const [open, setOpen] = useState(0);

  const scope = useGsap((gsap, el) => {
    revealChildren(gsap, el);
  });

  useMascotSection(scope, 'questioning');

  return (
    <Section ref={scope} id="faq" className="border-t border-surface-border py-28 md:py-32">
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
      </Container>
    </Section>
  );
}

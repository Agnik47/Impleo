import { useEffect, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Container, Section, Heading, Lead, Eyebrow } from '../components/primitives.jsx';
import JungleLayers from '../assets/jungle/JungleLayers.jsx';
import LeafField from '../components/LeafField.jsx';
import Chameleon from '../assets/mascot/Chameleon.jsx';
import ApprovalCheck from '../components/ApprovalCheck.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { revealChildren } from '../animations/storyReveal.js';
import { applyParallax } from '../animations/parallax.js';

/*
 * Beat 8 — Success.
 *
 * The payoff, and a deliberate rhyme with beat 2: the same clock face, the same
 * monospace, the same position — 45:00 struck through, 0:30 in brand green. The
 * page's argument closes by putting the two numbers in the same shape.
 *
 * The approved fields tick in one by one on scroll rather than all at once,
 * because "twelve fields, each one approved by you" is the claim being made.
 */
const FIELDS = ['Full name', 'Email', 'LinkedIn', 'GitHub', 'Role', 'Team size', 'Why attend', 'Your project', 'Availability', 'T-shirt size', 'Dietary needs', 'How you heard'];

export default function SuccessCelebration() {
  const reduced = useReducedMotion();
  const [ticked, setTicked] = useState(0);

  useEffect(() => {
    if (reduced) setTicked(FIELDS.length);
  }, [reduced]);

  const scope = useGsap((gsap, el) => {
    applyParallax(gsap, el);
    revealChildren(gsap, el);

    // Drive the count off scroll progress across the beat, so the ticks land as
    // the reader arrives rather than on a timer they can't see.
    ScrollTrigger.create({
      trigger: el,
      start: 'top 70%',
      end: 'center center',
      scrub: 0.4,
      onUpdate: (self) => setTicked(Math.round(self.progress * FIELDS.length)),
    });
  });

  useMascotSection(scope, 'celebrating');

  return (
    <Section ref={scope} id="success" className="overflow-hidden py-28 md:py-36">
      <JungleLayers edge="bottom" />
      <LeafField density={30} />

      <Container className="relative">
        <div className="mx-auto max-w-2xl text-center">
          {/* relative: the glow below is absolute and would otherwise anchor to
              the section and wash the whole beat. data-reveal and the idle
              float are on separate elements so GSAP and the CSS keyframe
              aren't both writing transform. */}
          <div data-reveal className="relative mx-auto mb-8 h-32 w-32" aria-hidden="true">
            <div className="absolute inset-6 -z-10 rounded-full bg-signature/20 blur-3xl animate-glow-pulse" />
            <div className="h-full w-full animate-float-slow">
              <Chameleon state="celebrating" />
            </div>
          </div>

          <div data-reveal>
            <Eyebrow>Done</Eyebrow>
          </div>
          <Heading data-reveal className="mt-4">
            Twelve fields. Every one approved by you.
          </Heading>

          <div data-reveal className="mt-10 flex items-center justify-center gap-5 sm:gap-8">
            <div className="text-center">
              <p className="font-mono text-[clamp(1.75rem,5vw,2.75rem)] font-bold leading-none text-ink-muted line-through decoration-ink-muted/40">
                5:00
              </p>
              <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-ink-muted">by hand</p>
            </div>
            <span className="text-brand" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
            <div className="text-center">
              <p className="font-mono text-[clamp(3rem,9vw,5rem)] font-bold leading-none text-brand">0:10</p>
              <p className="mt-2 text-[12px] uppercase tracking-[0.14em] text-ink-secondary">with Impleo</p>
            </div>
          </div>

          <Lead data-reveal className="mx-auto mt-8 max-w-lg">
            The form is filled and sitting there, in your words, waiting. The one thing
            Impleo will never do is press submit for you.
          </Lead>
        </div>

        {/* The approved field ledger. aria-hidden: it's a visual restatement of
            the heading's claim, and twelve ticking list items would be a poor
            listen. */}
        <ul
          aria-hidden="true"
          className="mx-auto mt-14 flex max-w-3xl flex-wrap justify-center gap-2.5"
        >
          {FIELDS.map((field, i) => {
            const done = i < ticked;
            return (
              <li
                key={field}
                className="flex items-center gap-2 rounded-full border border-surface-border bg-surface-card px-3 py-1.5 text-[13px] text-ink-secondary transition-colors duration-300 ease-premium"
                style={done ? { borderColor: 'rgba(40,201,78,0.4)' } : undefined}
              >
                <ApprovalCheck active={done} size="sm" className="!h-4 !w-4" />
                {field}
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}

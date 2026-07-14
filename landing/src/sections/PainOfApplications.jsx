import { useRef } from 'react';
import { Container, Section, Heading, Lead, Eyebrow } from '../components/primitives.jsx';
import FormCard from '../components/FormCard.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { applyParallax } from '../animations/parallax.js';
import { revealChildren } from '../animations/storyReveal.js';

/*
 * Beat 2 — The Pain of Applications.
 *
 * The chaos beat. A drift of unanswered required fields at four different
 * parallax depths, so scrolling pulls them past each other and the pile reads
 * as genuinely disordered rather than as a grid of cards. Every card is
 * mood="empty": nothing is filled, everything is required.
 *
 * The chameleon is still asleep here — Impleo hasn't entered the story.
 */

// Scattered by hand, not generated: each card's depth/rotation/offset is chosen
// so the cluster stays legible behind the copy and no card collides with the
// clock. Percentages keep the scatter proportional across breakpoints.
const CHAOS = [
  { label: 'Full name', depth: 0.55, top: '4%', left: '2%', rot: -6 },
  { label: 'Why do you want to attend?', depth: -0.5, top: '26%', left: '13%', rot: 4 },
  { label: 'Describe a project you shipped', depth: 0.3, top: '58%', left: '0%', rot: -3 },
  { label: 'LinkedIn URL', depth: -0.75, top: '78%', left: '20%', rot: 7 },
  { label: 'Tell us about yourself', depth: 0.7, top: '10%', left: '62%', rot: 5 },
  { label: 'Team size', depth: -0.35, top: '38%', left: '78%', rot: -8 },
  { label: 'What will you build?', depth: 0.45, top: '64%', left: '58%', rot: 3 },
  { label: 'GitHub', depth: -0.6, top: '86%', left: '74%', rot: -5 },
];

export default function PainOfApplications() {
  const clockRef = useRef(null);

  const scope = useGsap((gsap, el) => {
    applyParallax(gsap, el, { extra: 160 });
    revealChildren(gsap, el);

    // The clock counts up as you scroll — the cost accrues while you read,
    // which is the point of the beat. Scrubbed, so it's tied to scroll, not
    // playing on a timer the reader can't control.
    const counter = { v: 0 };
    gsap.to(counter, {
      v: 5,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 70%', end: 'center center', scrub: 0.6 },
      onUpdate: () => {
        const node = clockRef.current;
        if (!node) return;
        const mins = Math.floor(counter.v);
        const secs = Math.floor((counter.v - mins) * 60);
        node.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      },
    });
  });

  useMascotSection(scope, 'sleeping');

  return (
    <Section ref={scope} id="pain" className="overflow-hidden py-28 md:py-36">
      {/* The scatter field. Decorative: the copy carries the meaning, and a
          screen reader hitting eight fake form labels would just be noise. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {CHAOS.map((card) => (
          // Two nested elements on purpose: GSAP owns the outer element's
          // transform for the parallax drift, so the static rotation has to
          // live on its own child or the tween would overwrite it.
          <div
            key={card.label}
            data-parallax={card.depth}
            className="absolute will-transform"
            style={{ top: card.top, left: card.left }}
          >
            <div style={{ transform: `rotate(${card.rot}deg)` }}>
              <FormCard label={card.label} mood="empty" className="scale-90 opacity-60 md:scale-100 md:opacity-80" />
            </div>
          </div>
        ))}
      </div>

      {/* Vignette: pushes the scatter back so the copy always wins contrast. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_50%,rgba(11,15,14,0.96)_35%,rgba(11,15,14,0.55)_100%)]"
      />

      <Container className="relative">
        <div className="mx-auto max-w-2xl text-center">
          <div data-reveal>
            <Eyebrow>The real time sink</Eyebrow>
          </div>
          <Heading data-reveal className="mt-4">
            The mechanical fields are easy. The essays are the time sink.
          </Heading>
          <Lead data-reveal className="mx-auto mt-5 max-w-xl">
            Name and email take seconds. But “why do you want to attend,” “tell us about
            yourself,” “describe your project” — those mean digging through your resume,
            LinkedIn and GitHub, prompting a chatbot, then hand-copying it all back.
          </Lead>

          <div data-reveal className="mt-12">
            <p
              ref={clockRef}
              className="font-mono text-[clamp(3.5rem,11vw,6.5rem)] font-bold leading-none tracking-tight text-ink-muted"
            >
              45:00
            </p>
            <p className="mt-3 text-[13px] uppercase tracking-[0.14em] text-ink-muted">
              per application, by hand · several times a month
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

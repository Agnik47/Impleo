import { useEffect, useState } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Container, Section, Heading, Lead, Eyebrow } from '../components/primitives.jsx';
import JungleLayers from '../assets/jungle/JungleLayers.jsx';
import Chameleon from '../assets/mascot/Chameleon.jsx';
import FormCard from '../components/FormCard.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { revealChildren } from '../animations/storyReveal.js';
import { applyParallax } from '../animations/parallax.js';
import { cn } from '../lib/utils.js';

/*
 * Beat 3 — Chameleon Discovery.
 *
 * The turn. The chameleon wakes, scans, and the chaos from beat 2 resolves:
 * the same three questions that sat blank now carry drafted answers. The
 * empty→filled flip is the first time the reader sees the product do anything.
 *
 * The flip is driven by scroll position (ScrollTrigger onEnter), and reverses
 * on scroll-back so the beat can be re-read.
 */
const FIELDS = [
  { label: 'Why do you want to attend?', value: 'I want to ship something real alongside people who move fast…' },
  { label: 'Describe a project you shipped', value: 'An AI autofill copilot with a mandatory human review step…' },
  { label: 'LinkedIn URL', value: 'linkedin.com/in/you' },
];

export default function ChameleonDiscovery() {
  const reduced = useReducedMotion();
  const [discovered, setDiscovered] = useState(false);

  // Without GSAP (reduced motion) there is no scroll trigger to flip the cards,
  // so resolve straight to the answered state — the copy says the fields get
  // filled, and the visual must not contradict it.
  useEffect(() => {
    if (reduced) setDiscovered(true);
  }, [reduced]);

  const scope = useGsap((gsap, el) => {
    applyParallax(gsap, el);
    revealChildren(gsap, el);

    ScrollTrigger.create({
      trigger: el,
      start: 'top 55%',
      onEnter: () => setDiscovered(true),
      onLeaveBack: () => setDiscovered(false),
    });

    // Scan rings pulse outward from the mascot on repeat while the beat is in
    // view. Paused when off-screen so it never burns frames in the background.
    const rings = gsap.timeline({
      repeat: -1,
      paused: true,
      scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', toggleActions: 'play pause resume pause' },
    });
    rings.fromTo(
      '[data-scan-ring]',
      { scale: 0.35, opacity: 0.55 },
      { scale: 1.9, opacity: 0, duration: 2.6, ease: 'power1.out', stagger: 0.85 }
    );
  });

  useMascotSection(scope, 'discovering');

  return (
    <Section ref={scope} id="discovery" className="overflow-hidden py-28 md:py-36">
      <JungleLayers edge="top" />

      <Container className="relative">
        <div className="mx-auto max-w-2xl text-center">
          <div data-reveal>
            <Eyebrow>Enter Impleo</Eyebrow>
          </div>
          <Heading data-reveal className="mt-4">
            Then something in the leaves opens one eye.
          </Heading>
          <Lead data-reveal className="mx-auto mt-5 max-w-xl">
            Open the side panel on any form page. Impleo reads every question and every
            field type — text, radios, checkboxes, dropdowns — and drafts an answer for
            each one, grounded in the profile you gave it.
          </Lead>
        </div>

        <div className="relative mt-20 flex flex-col items-center">
          {/* Mascot + scan rings */}
          <div className="relative h-48 w-48" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                data-scan-ring
                className="absolute inset-0 rounded-full border border-lime/50"
              />
            ))}
            <div className="absolute inset-6 -z-10 rounded-full bg-lime/20 blur-3xl animate-glow-pulse" />
            <div className="relative h-full w-full animate-float-slow">
              <Chameleon state="discovering" />
            </div>
          </div>

          {/* The three fields from the chaos beat, now resolving. */}
          <div className="mt-14 grid w-full grid-cols-1 justify-items-center gap-4 sm:grid-cols-3 sm:gap-5">
            {FIELDS.map((f, i) => (
              // Outer element: GSAP's parallax transform. Inner element: the
              // settle. Sharing one element would let the parallax tween
              // clobber the lift.
              <div key={f.label} data-parallax={i === 1 ? 0.18 : -0.12} className="will-transform">
                <div
                  className={cn(
                    'transition-transform duration-500 ease-premium',
                    // The middle card lifts when the scan lands — a settle, not
                    // a hover effect.
                    discovered && i === 1 && '-translate-y-2'
                  )}
                  style={{ transitionDelay: `${i * 90}ms` }}
                >
                  <FormCard
                    label={f.label}
                    value={f.value}
                    mood={discovered ? 'filled' : 'empty'}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

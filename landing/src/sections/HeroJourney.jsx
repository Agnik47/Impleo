import { Container, Section, Heading, Lead, Eyebrow, PrimaryButton, GhostButton } from '../components/primitives.jsx';
import JungleLayers from '../assets/jungle/JungleLayers.jsx';
import LeafField from '../components/LeafField.jsx';
import HeroCanopy from '../components/HeroCanopy.jsx';
import Chameleon from '../assets/mascot/Chameleon.jsx';
import ReviewCard from '../components/ReviewCard.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { useSmoothScroll } from '../providers/SmoothScrollProvider.jsx';
import { applyParallax } from '../animations/parallax.js';
import { EASE, DURATION } from '../motion/tokens.js';
import { CHROME_STORE_URL, TRUST_TRIAD } from '../lib/constants.js';

/*
 * Beat 1 — Hero Journey.
 *
 * The chameleon is asleep in the canopy: the story starts before Impleo exists,
 * so nothing here is "discovered" yet. The headline arrives as a masked
 * type-slide (each line pushed up behind an overflow-hidden wrapper), never a
 * fade — per the brief's forbidden list.
 */
export default function HeroJourney() {
  const { scrollTo } = useSmoothScroll();

  const scope = useGsap((gsap, el) => {
    applyParallax(gsap, el);

    // Entrance: transform + clip only, no opacity anywhere.
    gsap
      .timeline({ defaults: { ease: EASE.expo, duration: DURATION.story } })
      .from('[data-hero-line]', { yPercent: 115, stagger: 0.09 })
      .from('[data-hero-sub]', { yPercent: 100 }, '-=0.62')
      .from(
        '[data-hero-cta]',
        { y: 18, clipPath: 'inset(0% 0% 100% 0%)', duration: DURATION.slow, stagger: 0.06 },
        '-=0.45'
      )
      .from(
        '[data-hero-stage]',
        { x: 40, clipPath: 'inset(0% 0% 0% 100%)', duration: 1.1 },
        '-=0.8'
      );

    // The sleeping mascot drifts up gently as you begin to scroll away — the
    // canopy holding still while the reader moves.
    gsap.to('[data-hero-mascot]', {
      y: -60,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top top', end: 'bottom top', scrub: 0.6 },
    });
  });

  useMascotSection(scope, 'sleeping');

  return (
    <Section ref={scope} id="hero" className="flex min-h-screen items-center overflow-hidden pb-20 pt-28">
      {/* Three jungle layers, cheapest first, each a complete fallback for the
          one after it: SVG silhouettes (everyone) → 2D drifting leaves (motion
          allowed) → the WebGL canopy (desktop + WebGL only). */}
      <JungleLayers edge="both" />
      <LeafField density={22} />
      <HeroCanopy />

      <Container className="relative grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <div className="overflow-hidden pb-1">
            <div data-hero-line>
              <Eyebrow>AI autofill, but you stay in control</Eyebrow>
            </div>
          </div>

          <Heading as="h1" size="xl" className="mt-5">
            {/* Each line is masked independently so they stagger in like type
                being set, rather than the whole block moving as one slab. */}
            <span className="block overflow-hidden pb-1">
              <span data-hero-line className="block">
                Fill any application
              </span>
            </span>
            <span className="block overflow-hidden pb-1">
              <span data-hero-line className="block">
                form in{' '}
                <span className="chameleon-text">under 10 seconds.</span>
              </span>
            </span>
          </Heading>

          <div className="mt-6 max-w-xl overflow-hidden">
            <div data-hero-sub>
              <Lead>
                Impleo reads the form, drafts every answer in <em>your</em> voice, and
                waits for your approval before a single field is touched. Hackathons,
                fellowships, scholarships — done.
              </Lead>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div data-hero-cta>
              <PrimaryButton href={CHROME_STORE_URL}>Add to Chrome — Free</PrimaryButton>
            </div>
            <div data-hero-cta>
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
          </div>

          <p data-hero-cta className="mt-5 text-[13px] text-ink-muted">
            {TRUST_TRIAD}
          </p>
        </div>

        <div data-hero-stage className="lg:col-span-5">
          <div className="relative">
            {/* Sleeping chameleon, perched above the review card it will later
                come to fill in. */}
            {/* Three layers, each owning exactly one transform: the outer div
                is GSAP's (the scroll drift), the inner is the CSS idle float.
                On one element the CSS animation would win and the drift would
                never render. */}
            <div
              data-hero-mascot
              aria-hidden="true"
              className="relative z-10 mx-auto mb-[-28px] h-40 w-40 lg:mx-0 lg:ml-auto lg:mr-4"
            >
              <div className="absolute inset-4 -z-10 rounded-full bg-lime/20 blur-3xl animate-glow-pulse" />
              <div className="h-full w-full animate-float-slow">
                <Chameleon state="sleeping" />
              </div>
            </div>

            <ReviewCard
              question="Why do you want to attend this hackathon?"
              confidence="high"
              autoAccept
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}

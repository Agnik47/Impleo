import { Container, Section, Heading, Lead, Eyebrow } from '../components/primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import JungleLayers from '../assets/jungle/JungleLayers.jsx';
import LeafField from '../components/LeafField.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { horizontalScroll } from '../animations/horizontalScroll.js';
import { revealChildren } from '../animations/storyReveal.js';
import { PIPELINE_STEPS } from '../lib/constants.js';
import { cn } from '../lib/utils.js';

/*
 * Beat 4 — The Extraction Pipeline. The horizontal story section.
 *
 * Detect → Extract → Generate → Review → Fill is a sequence, so it is read
 * sideways: the pinned rail turns vertical scrolling into lateral travel, and
 * the reader physically moves along the pipeline.
 *
 * Three different experiences, deliberately:
 *   desktop (lg+)   pinned + scrubbed horizontal travel
 *   touch/small     a native snap-swipe rail — pinned scroll-jacking fights
 *                   momentum scrolling on touch and is the usual reason these
 *                   sections feel broken on phones
 *   reduced motion  useGsap never runs, so the rail is simply the same natively
 *                   scrollable, snap-aligned list at every size
 * The markup is identical in all three; only the GSAP layer differs.
 *
 * The heading lives INSIDE [data-pin], not before it. Putting it in normal
 * flow above a separate h-screen pinned box meant two full viewport heights
 * stacked back to back — heading's own screen, then an entirely fresh screen
 * that re-centered the cards in the middle of empty space below it. Sharing
 * one pinned frame means heading + cards compose as a single scene, and the
 * heading now stays pinned alongside the cards as they travel, instead of
 * scrolling away before the pipeline even starts.
 */
const STEP_ICON = ['detect', 'form', 'model', 'review', 'fill'];
// Fixed per-card tilt for the watermark leaves — deliberately uneven so the
// row doesn't read as a repeated stamp.
const WATERMARK_TILT = [-14, 9, -7, 16, -5];

// A single leaf silhouette (same two-curve construction LeafField draws to
// canvas), reused here as a crisp inline SVG watermark so the cards carry the
// site's leaf motif rather than sitting as bare text blocks.
function LeafWatermark({ className = '', style }) {
  return (
    <svg viewBox="0 0 100 140" aria-hidden="true" className={className} style={style} fill="currentColor">
      <path d="M50 4 C74 26 92 58 50 136 C8 58 26 26 50 4 Z" />
    </svg>
  );
}

export default function ExtractionPipeline() {
  const scope = useGsap((gsap, el) => {
    revealChildren(gsap, el);

    const pin = el.querySelector('[data-pin]');
    if (!pin) return;

    // Pin only where there's a mouse wheel and room to travel. mm is created
    // inside the gsap.context() that useGsap owns, so it reverts with it.
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px)', () => {
      horizontalScroll(gsap, pin);
    });
  });

  useMascotSection(scope, 'filling');

  return (
    <Section ref={scope} id="extraction" className="overflow-hidden py-20 md:py-24">
      {/* Jungle scenery — the section had none, so it read as a bare panel
          dropped between two heavily-atmospheric beats (Discovery above,
          Review below). Same components those use, lighter density: the
          cards are the foreground here, not the scenery. */}
      <JungleLayers edge="top" />
      <LeafField density={20} />

      {/* The pinned viewport. On lg+ this holds still while [data-track]
          slides; heading and cards share its vertical centering as one unit. */}
      <div data-pin className="relative flex flex-col justify-center gap-10 lg:h-screen lg:gap-14 lg:overflow-hidden">
        <Container>
          <div className="max-w-2xl">
            <div data-reveal>
              <Eyebrow>How it works</Eyebrow>
            </div>
            <Heading data-reveal className="mt-4">
              Five steps, and the chameleon adapts to each form.
            </Heading>
            <Lead data-reveal className="mt-5">
              One pass down the page, one AI call, and every answer lands in front of you
              before anything is written back.
            </Lead>
          </div>
        </Container>

        <div>
          <div className="no-scrollbar snap-x snap-mandatory overflow-x-auto pb-4 lg:snap-none lg:overflow-visible lg:pb-0">
            <div data-track className="flex w-max gap-5 px-6 will-transform lg:gap-8 lg:px-[max(1.5rem,calc((100vw-1120px)/2))]">
              {PIPELINE_STEPS.map((step, i) => (
                <article
                  key={step.n}
                  className={cn(
                    'relative flex w-[76vw] shrink-0 snap-center flex-col justify-between overflow-hidden rounded-card border border-surface-border bg-surface-card p-7 sm:w-[380px] lg:h-[360px] lg:w-[400px] lg:p-9',
                    // The last card is the payoff — it carries the brand edge.
                    i === PIPELINE_STEPS.length - 1 && 'border-brand/40'
                  )}
                >
                  {/* Oversized, near-invisible leaf watermark — fills the gap
                      between the body copy and the step ticks that otherwise
                      reads as dead space, and ties the card back to the
                      leaf motif used everywhere else on the page. Clipped to
                      the card's own rounded corners via the article's
                      overflow-hidden. */}
                  <LeafWatermark
                    className="pointer-events-none absolute -bottom-8 -right-8 h-44 w-44 text-lime/[0.07]"
                    style={{ transform: `rotate(${WATERMARK_TILT[i]}deg)` }}
                  />

                  <div className="relative">
                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-input bg-jungle text-lime">
                      <Icon name={STEP_ICON[i]} className="h-5 w-5" />
                    </div>
                    <span className="font-mono text-[13px] font-semibold text-lime">{step.n}</span>
                    <h3 className="mt-2 text-display-md font-semibold text-ink-primary">{step.title}</h3>
                    <p className="mt-3 text-[15px] leading-relaxed text-ink-secondary">{step.body}</p>
                  </div>

                  {/* Hairline step ticks — position within the pipeline, at a
                      glance, without a second legend. */}
                  <div aria-hidden="true" className="relative mt-8 flex gap-1.5">
                    {PIPELINE_STEPS.map((s, j) => (
                      <span
                        key={s.n}
                        className={cn('h-[3px] flex-1 rounded-full', j <= i ? 'bg-brand' : 'bg-surface-border')}
                      />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Scrub-linked progress bar — desktop only, where the pin drives it. */}
          <div aria-hidden="true" className="mx-auto mt-8 hidden h-px w-full max-w-container bg-surface-border lg:block">
            <div data-track-progress className="chameleon-line h-full w-full origin-left" />
          </div>
        </div>
      </div>
    </Section>
  );
}

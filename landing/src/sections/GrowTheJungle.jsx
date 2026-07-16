import { Container, Section, Heading, Lead, Eyebrow, PrimaryButton, GhostButton } from '../components/primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import JungleLayers from '../assets/jungle/JungleLayers.jsx';
import LeafField from '../components/LeafField.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { revealChildren } from '../animations/storyReveal.js';
import { CONTRIBUTE_WAYS, JUNGLE_RULES, GITHUB_URL, GITHUB_ISSUES_URL } from '../lib/constants.js';

/*
 * Coda — Grow the jungle.
 *
 * Sits after the ask on purpose. A reader who is still scrolling past the CTA
 * has already decided; this is for them, and burying it above the CTA would
 * only cost conversions. The chameleon spends it 'planting' — tending a
 * seedling, which is the whole point of the beat.
 *
 * Structured cheapest-effort-first — a star, then an issue, then a branch, then
 * docs — because "contribute" sections that open on "submit a pull request"
 * filter out everyone who would have helped in a smaller way.
 *
 * The three rules are stated here rather than left in CONTRIBUTING.md because
 * they are the reasons a PR gets turned down, and the worst time to learn them
 * is after the work is done.
 */
export default function GrowTheJungle() {
  const scope = useGsap((gsap, el) => {
    revealChildren(gsap, el);
  });

  // NOTE: this hardcoded string — not SECTIONS[].mascot in lib/constants.js —
  // is what actually drives the companion. Keep the two in sync.
  useMascotSection(scope, 'planting');

  return (
    <Section
      ref={scope}
      id="contribute"
      className="jungle-radial overflow-hidden border-t border-surface-border py-28 md:py-36"
    >
      <JungleLayers edge="bottom" />
      <LeafField density={18} />

      <Container className="relative">
        <div className="mx-auto max-w-2xl text-center">
          <div data-reveal>
            <Eyebrow>Open source · MIT</Eyebrow>
          </div>
          <Heading data-reveal className="mt-4">
            A jungle grows faster
            <br />
            <span className="chameleon-text">with more hands in it.</span>
          </Heading>
          <div data-reveal className="mt-5">
            <Lead>
              Impleo is built in the open, by people who got tired of typing the same answer
              twice. Every part of it is readable, forkable, and yours. Here’s where help
              lands best.
            </Lead>
          </div>
        </div>

        <ul className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2">
          {CONTRIBUTE_WAYS.map(({ icon, title, body, cta, href }, i) => (
            <li
              key={title}
              data-reveal
              // Alternating origin so the four cards arrive as a canopy filling
              // in from both edges, not a single column marching up.
              data-reveal-x={i % 2 === 0 ? -24 : 24}
              className="group flex flex-col rounded-card border border-surface-border bg-surface-card/70 p-6 backdrop-blur-sm transition-colors duration-200 ease-premium hover:border-lime/30 hover:bg-surface-card-hover"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-input bg-jungle text-lime">
                  <Icon name={icon} className="h-5 w-5" />
                </span>
                <h3 className="text-[16px] font-semibold text-ink-primary">{title}</h3>
              </div>
              <p className="mt-4 grow text-[14px] leading-relaxed text-ink-secondary">{body}</p>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 self-start rounded-btn text-[13px] font-semibold text-lime outline-none transition-colors duration-150 hover:text-signature focus-visible:ring-2 focus-visible:ring-lime"
              >
                {cta}
                {/* Travels on hover instead of scaling — scale is a forbidden
                    pattern, and a nudge along the reading direction is the
                    cheaper signal anyway. */}
                <span className="transition-transform duration-200 ease-premium group-hover:translate-x-0.5">
                  <Icon name="arrow" className="h-4 w-4" />
                </span>
              </a>
            </li>
          ))}
        </ul>

        {/* The house rules. */}
        <div className="mx-auto mt-20 max-w-4xl">
          <div data-reveal className="text-center">
            <Eyebrow>Three rules of the jungle</Eyebrow>
            <p className="mx-auto mt-3 max-w-[46ch] text-[14px] leading-relaxed text-ink-muted">
              Impleo stays small, boring and correct on purpose. These three aren’t
              negotiable — everything else is up for discussion.
            </p>
          </div>

          <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {JUNGLE_RULES.map(({ title, body }, i) => (
              <li
                key={title}
                data-reveal
                className="relative rounded-card border border-surface-border bg-surface-card/60 p-6"
              >
                <span className="text-[12px] font-semibold tabular-nums tracking-[0.14em] text-signature">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 flex items-center gap-2 text-[15px] font-semibold text-ink-primary">
                  <Icon name="shield" className="h-4 w-4 shrink-0 text-lime" />
                  {title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">{body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div data-reveal className="mt-16 flex flex-wrap justify-center gap-3">
          <PrimaryButton href={GITHUB_URL} target="_blank" rel="noreferrer">
            <Icon name="github" className="h-4 w-4" />
            Star on GitHub
          </PrimaryButton>
          <GhostButton href={GITHUB_ISSUES_URL} target="_blank" rel="noreferrer">
            <Icon name="issue" className="h-4 w-4" />
            Open an issue
          </GhostButton>
        </div>

        <p data-reveal className="mt-6 text-center text-[13px] text-ink-muted">
          MIT licensed · Fork it, ship it, make it yours
        </p>
      </Container>
    </Section>
  );
}

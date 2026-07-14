import { Container, Section, Heading, Eyebrow } from '../components/primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import Chameleon from '../assets/mascot/Chameleon.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { revealChildren } from '../animations/storyReveal.js';
import { PRIVACY_PLEDGES } from '../lib/constants.js';

/*
 * Beat 6 — Privacy Architecture.
 *
 * The one beat that is a diagram, not a scene: "local-first" is an
 * architectural claim, so it gets drawn as an architecture — three nodes and
 * the whole path between them, with nothing else in it. The connector draws
 * itself on scrub, tracing the request as you read.
 *
 * Deliberately the quietest section: hairline grid, no particles, no drifting
 * cards. A trust claim shouldn't be competing with atmosphere.
 */
const NODES = [
  { title: 'Your browser', body: 'The side panel and the form page.', icon: 'form' },
  { title: 'localhost server', body: 'Your profile, your keys, your SQLite file.', icon: 'lock' },
  { title: 'Your chosen provider', body: 'Only the request you approved.', icon: 'model' },
];

export default function PrivacyArchitecture() {
  const scope = useGsap((gsap, el) => {
    revealChildren(gsap, el);

    // The connector traces left→right (or top→bottom on mobile) as the beat is
    // read. transformOrigin is set per axis by the utility classes below.
    gsap.fromTo(
      '[data-wire]',
      { scaleX: 0, scaleY: 0 },
      {
        scaleX: 1,
        scaleY: 1,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 65%', end: 'center center', scrub: 0.6 },
      }
    );
  });

  useMascotSection(scope, 'protecting');

  return (
    <Section ref={scope} id="privacy" className="overflow-hidden py-28 md:py-36">
      <div aria-hidden="true" className="jungle-grid pointer-events-none absolute inset-0 opacity-40" />
      {/* Fades the grid out at the edges so it reads as a substrate, not a table. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_50%,transparent_20%,rgba(11,15,14,0.95)_85%)]"
      />

      <Container className="relative">
        <div className="mx-auto max-w-2xl text-center">
          {/* relative anchors the glow to the mascot, not the section. */}
          <div data-reveal className="relative mx-auto mb-8 h-24 w-24" aria-hidden="true">
            <div className="absolute inset-0 -z-10 rounded-full bg-brand/15 blur-3xl" />
            <Chameleon state="protecting" />
          </div>
          <div data-reveal>
            <Eyebrow>Private by design</Eyebrow>
          </div>
          <Heading data-reveal className="mt-4">
            Local-first. No hosted server, no middleman.
          </Heading>
        </div>

        {/* The path. Vertical on mobile, horizontal from md up. */}
        <div className="relative mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {/* Horizontal wire (md+): sits behind the nodes, spanning the middle. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[16%] right-[16%] top-1/2 hidden md:block"
          >
            <div data-wire className="chameleon-line h-px w-full origin-left" />
          </div>
          {/* Vertical wire (mobile). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[12%] left-1/2 top-[12%] block w-px md:hidden"
          >
            <div data-wire className="chameleon-line h-full w-px origin-top" />
          </div>

          {NODES.map((node) => (
            <div
              key={node.title}
              data-reveal
              className="relative rounded-card border border-surface-border bg-surface-card p-6 text-center"
            >
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-input bg-jungle text-lime">
                <Icon name={node.icon} className="h-5 w-5" />
              </div>
              <h3 className="text-[15px] font-semibold text-ink-primary">{node.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">{node.body}</p>
            </div>
          ))}
        </div>

        <p data-reveal className="mt-8 text-center text-[13px] text-ink-muted">
          No third-party cloud anywhere in that path.
        </p>

        <ul className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
          {PRIVACY_PLEDGES.map((pledge) => (
            <li
              key={pledge}
              data-reveal
              className="flex items-start gap-3 rounded-card border border-surface-border bg-surface-card/60 p-5 text-[14px] leading-relaxed text-ink-primary"
            >
              <span className="mt-0.5 shrink-0 text-signature">
                <Icon name="shield" className="h-5 w-5" />
              </span>
              {pledge}
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

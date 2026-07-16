import { useState } from 'react';
import { Container, Section, Heading, PrimaryButton, GhostButton } from '../components/primitives.jsx';
import { Icon } from '../components/Icon.jsx';
import LeafField from '../components/LeafField.jsx';
import { useGsap } from '../hooks/useGsap.js';
import { useMascotSection } from '../hooks/useMascotSection.js';
import { useSmoothScroll } from '../providers/SmoothScrollProvider.jsx';
import { revealChildren } from '../animations/storyReveal.js';
import {
  TRUST_TRIAD,
  GROWTH_STAGES,
  QUICK_START_LINES,
  QUICK_START_COMMAND,
  AGENT_PROMPT,
  GITHUB_URL,
  INSTALL_GUIDE_URL,
} from '../lib/constants.js';
import { cn } from '../lib/utils.js';

/*
 * Beat 9 — CTA. The objections that used to live here are now their own beat,
 * QuestionsAnswered, directly above.
 *
 * The ask is a clone, not a store install, because the store listing isn't live
 * yet. Rather than park a dead "Add to Chrome" button behind a Coming Soon
 * badge, the wait is staged as the thing the whole site is already about —
 * growth. Seed → Sprout → Canopy, with the reader standing on Sprout, which is
 * a stage they can act on today rather than a date they have to trust.
 */

// Reader-facing copy for the one action that works right now.
function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard is permission-gated and absent on insecure origins. The
      // command is on screen either way, so a failure here is a non-event —
      // never surface an error for something the reader can just select.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-btn px-2 py-1 text-[11px] font-medium text-ink-muted outline-none transition duration-150 ease-premium hover:bg-white/5 hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-lime"
    >
      <Icon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" />
      {/* aria-live so the confirmation is announced, not just seen. */}
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}

// Seed → Sprout → Canopy. Mirrors the connector-and-nodes language the privacy
// beat already established, so the site has one way of drawing a path.
function GrowthRail() {
  return (
    <ol className="relative mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 text-left sm:grid-cols-3 sm:gap-6">
      {/* The wire, behind the nodes. Horizontal from sm up, vertical below. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[16%] right-[16%] top-[26px] hidden sm:block"
      >
        <div className="chameleon-line h-px w-2/3" />
        <div className="absolute inset-y-0 right-0 w-1/3 border-t border-dashed border-surface-border" />
      </div>

      {GROWTH_STAGES.map(({ stage, body, done, here }) => (
        <li
          key={stage}
          className={cn(
            'relative rounded-card border bg-surface-bg/80 p-5 backdrop-blur-sm transition duration-200 ease-premium',
            here ? 'border-lime/40' : 'border-surface-border'
          )}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'relative flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-full border-2',
                done ? 'border-lime bg-lime' : 'border-surface-border bg-surface-bg'
              )}
            >
              {/* The live stage breathes — the same ambient glow the jungle
                  scenery uses, so it reads as growth rather than a loader. */}
              {here && (
                <span
                  aria-hidden="true"
                  className="absolute -inset-1.5 rounded-full bg-lime/40 blur-sm animate-glow-pulse"
                />
              )}
            </span>
            <span
              className={cn(
                'text-[13px] font-semibold uppercase tracking-[0.14em]',
                here ? 'text-lime' : done ? 'text-ink-secondary' : 'text-ink-muted'
              )}
            >
              {stage}
            </span>
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-ink-secondary">{body}</p>
          {here && (
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-signature">
              <Icon name="sprout" className="h-3.5 w-3.5" />
              You are here
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

export default function FinalCTA() {
  const { scrollTo } = useSmoothScroll();

  const scope = useGsap((gsap, el) => {
    revealChildren(gsap, el);
  });

  useMascotSection(scope, 'celebrating');

  return (
    <Section ref={scope} id="cta" className="border-t border-surface-border py-24 md:py-28">
      <Container>
        {/* The ask. */}
        <div
          data-reveal
          className="relative overflow-hidden rounded-card border border-surface-border bg-surface-card px-6 py-16 text-center"
        >
          <LeafField density={14} />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 rounded-full bg-lime/15 blur-3xl animate-glow-pulse"
          />

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-signature/30 bg-signature/10 px-3 py-1 text-[12px] font-medium text-signature">
              <Icon name="sprout" className="h-3.5 w-3.5" />
              Chrome Web Store — still sprouting
            </span>

            <Heading as="h2" className="mt-5">
              The store listing isn’t ready.
              <br />
              <span className="chameleon-text">The jungle already is.</span>
            </Heading>

            <p className="mx-auto mt-5 max-w-[54ch] text-lead text-ink-secondary">
              Impleo is finished, open source, and free today — it just arrives by clone
              instead of by one click. Five minutes and it’s running on your machine.
            </p>

            <GrowthRail />

            {/* The command, verbatim from INSTALLATION.md. */}
            <div className="mx-auto mt-12 max-w-[620px] overflow-hidden rounded-card border border-surface-border bg-jungle text-left">
              <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5">
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  <Icon name="terminal" className="h-3.5 w-3.5" />
                  Five minutes, start to finish
                </span>
                <CopyButton value={QUICK_START_COMMAND} label="Copy" />
              </div>
              <pre className="overflow-x-auto px-4 py-4 text-[12.5px] leading-[1.9]">
                <code>
                  {QUICK_START_LINES.map((line) => (
                    <span key={line} className="block whitespace-pre">
                      <span className="select-none text-lime">$ </span>
                      <span className="text-ink-secondary">{line}</span>
                    </span>
                  ))}
                </code>
              </pre>
              <p className="border-t border-white/5 px-4 py-3 text-[12px] leading-relaxed text-ink-muted">
                Then load <span className="text-ink-secondary">extension/dist</span> at{' '}
                <span className="text-ink-secondary">chrome://extensions</span> and paste in your
                API key. That’s the whole thing.
              </p>
            </div>

            {/* Impleo is an AI product installed by an AI agent — INSTALLATION.md
                is written as an executable runbook, so this is a real shortcut. */}
            <div className="mx-auto mt-4 flex max-w-[620px] items-center justify-between gap-3 rounded-card border border-dashed border-surface-border px-4 py-3 text-left">
              <p className="text-[12px] leading-relaxed text-ink-muted">
                Or hand it to your coding agent —{' '}
                <span className="text-ink-secondary">“{AGENT_PROMPT}”</span>
              </p>
              <CopyButton value={AGENT_PROMPT} label="Copy prompt" />
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <PrimaryButton href={INSTALL_GUIDE_URL} target="_blank" rel="noreferrer">
                <Icon name="book" className="h-4 w-4" />
                Read the install guide
              </PrimaryButton>
              <GhostButton href={GITHUB_URL} target="_blank" rel="noreferrer">
                <Icon name="github" className="h-4 w-4" />
                View on GitHub
              </GhostButton>
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

            <p className="mt-5 text-[13px] text-ink-muted">{TRUST_TRIAD}</p>
          </div>
        </div>
      </Container>
    </Section>
  );
}

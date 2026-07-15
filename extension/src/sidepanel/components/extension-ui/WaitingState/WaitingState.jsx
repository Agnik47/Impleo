import { motion } from 'motion/react';
import { STAGGER_CONTAINER, DIRECTIONAL_STEP } from '../MotionSystem/motion.js';
import { useReducedMotion } from '../MotionSystem/useReducedMotion.js';

/*
 * The empty state shown alongside HeroCard when no form has been extracted
 * yet — explains what's about to happen before the user clicks Extract, via
 * a small looping pipeline rather than a static paragraph.
 *
 * The "looping" part is scoped to the connector lines (a glow traveling
 * down each one, tailwind.config.js's `flow-travel`), not the step icons
 * themselves — a constantly-animating icon at rest reads as broken/spinning,
 * a quiet traveling glow reads as "this is how data moves through the
 * pipeline."
 */
const STEPS = [
  { key: 'website', label: 'Website', hint: 'the form you’re on', icon: 'globe' },
  { key: 'impleo', label: 'Impleo', hint: 'reads it, drafts answers', icon: 'spark' },
  { key: 'approved', label: 'Approved answers', hint: 'only what you accept', icon: 'check' },
  { key: 'filled', label: 'Filled form', hint: 'never auto-submitted', icon: 'file' },
];

const ICONS = {
  globe: 'M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M3 12h18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  spark: 'M12 4 l1.6 5.4 5.4 1.6-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6Z',
  check: 'M20 6 9 17l-5-5',
  file: 'M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3v4h4M9 13h6M9 16h6',
};

function StepIcon({ icon }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[icon]} />
    </svg>
  );
}

export default function WaitingState() {
  const reduced = useReducedMotion();

  return (
    <div className="glass-surface rounded-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          {!reduced && <span className="absolute inline-flex h-full w-full animate-glow-pulse rounded-full bg-lime" />}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime" />
        </span>
        <p className="text-body font-medium text-ink-primary">Waiting for a form&hellip;</p>
      </div>

      <motion.ol
        initial={reduced ? false : 'hidden'}
        animate="visible"
        variants={STAGGER_CONTAINER}
        className="space-y-0"
      >
        {STEPS.map((step, i) => (
          <motion.li key={step.key} variants={DIRECTIONAL_STEP} className="relative flex gap-3 pb-5 last:pb-0">
            {i < STEPS.length - 1 && (
              <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px overflow-hidden bg-surface-border">
                {!reduced && (
                  <span
                    className="absolute left-0 h-2 w-px animate-flow-travel bg-lime shadow-[0_0_6px_1px_rgba(166,217,26,0.7)]"
                    style={{ animationDelay: `${i * 0.5}s` }}
                  />
                )}
              </span>
            )}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand/25 bg-surface-card text-brand">
              <StepIcon icon={step.icon} />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-card font-medium text-ink-primary">{step.label}</p>
              <p className="text-caption text-ink-muted">{step.hint}</p>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}

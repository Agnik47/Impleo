import { motion } from 'motion/react';
import Chameleon from '../MotionSystem/Chameleon.jsx';
import { REVEAL_MASK, STAGGER_CONTAINER, STAGGER_ITEM } from '../MotionSystem/motion.js';
import { useReducedMotion } from '../MotionSystem/useReducedMotion.js';

/*
 * The "living hero" — the panel's first impression, shown only in the idle
 * state (same placement as the WelcomeHero it replaces in ReviewFlow.jsx;
 * this is a render-only swap, no change to when it appears).
 *
 * Entrance is a reveal mask (clip-path wipe), not a fade — see MotionSystem/
 * motion.js's note on why. The badge row staggers in as a group beneath it.
 */
const BADGES = [
  { label: 'Local First' },
  { label: 'Private by Design' },
  { label: 'Bring Your Own API' },
];

const PROMISE_LINES = ['Extract once.', 'Approve once.', 'Never type twice.'];

export default function HeroCard() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : 'hidden'}
      animate="visible"
      variants={REVEAL_MASK}
      className="glass-surface relative flex flex-col items-center gap-3 overflow-hidden rounded-card p-5 text-center shadow-soft"
    >
      <MascotStage reduced={reduced} />

      <div className="space-y-1">
        <h2 className="text-title text-ink-primary">Hey, I&apos;m Impleo 🦎</h2>
        <p className="text-card text-ink-secondary">Your AI copilot for forms.</p>
      </div>

      <p className="text-body leading-relaxed text-ink-secondary">
        {PROMISE_LINES.map((line, i) => (
          <span key={line}>
            {i > 0 && <br />}
            {i === PROMISE_LINES.length - 1 ? <span className="chameleon-text font-medium">{line}</span> : line}
          </span>
        ))}
      </p>

      <motion.div
        initial={reduced ? false : 'hidden'}
        animate="visible"
        variants={STAGGER_CONTAINER}
        className="flex flex-wrap items-center justify-center gap-1.5 pt-1"
      >
        {BADGES.map((b) => (
          <motion.span
            key={b.label}
            variants={STAGGER_ITEM}
            className="inline-flex items-center gap-1.5 rounded-btn border border-brand/20 bg-brand/[0.08] px-2 py-1 text-caption text-ink-secondary"
          >
            <span className="relative flex h-1.5 w-1.5">
              {!reduced && (
                <span className="absolute inline-flex h-full w-full animate-glow-pulse rounded-full bg-brand" />
              )}
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            {b.label}
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  );
}

// Isolated so the mascot's own ambient motion (breathing, orbiting motes)
// doesn't force the copy/badges above to re-render — it's a self-contained
// subtree with its own tiny bit of decoration.
function MascotStage({ reduced }) {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <div
        className={`absolute h-20 w-20 rounded-full bg-lime/25 blur-2xl ${reduced ? '' : 'animate-glow-pulse'}`}
        aria-hidden="true"
      />
      {!reduced && (
        <>
          <span
            className="absolute h-1.5 w-1.5 rounded-full bg-lime/70 animate-float-slow"
            style={{ top: '4%', left: '8%' }}
            aria-hidden="true"
          />
          <span
            className="absolute h-1 w-1 rounded-full bg-signature/70 animate-float-slower"
            style={{ bottom: '2%', right: '6%' }}
            aria-hidden="true"
          />
        </>
      )}
      <div className={`h-16 w-16 drop-shadow-[0_0_20px_rgba(166,217,26,0.35)] ${reduced ? '' : 'animate-mascot-breathe'}`}>
        <Chameleon state="discovering" animated={!reduced} />
      </div>
    </div>
  );
}

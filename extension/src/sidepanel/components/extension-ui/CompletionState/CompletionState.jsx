import { motion } from 'motion/react';
import Chameleon from '../MotionSystem/Chameleon.jsx';
import { REVEAL_MASK } from '../MotionSystem/motion.js';
import { useReducedMotion } from '../MotionSystem/useReducedMotion.js';

/*
 * The celebration banner shown once a fill completes with nothing failed.
 * Purely additive to ReviewFlow: it renders alongside the existing approve/
 * fill summary bar (which is left exactly as it was), gated on a derived
 * boolean computed from `fillReport` that ReviewFlow already tracks — no new
 * state, no change to handleFill's own logic (see ReviewFlow.jsx's
 * `allFilledSuccessfully`).
 *
 * The mascot uses the existing "celebrating" pose (built for exactly this
 * story beat — see landing's own sleeping→…→celebrating mascot journey)
 * rather than a literal wink, which would need new asymmetric eye geometry
 * added to the shared, faithfully-ported Chameleon component. A one-shot
 * bounce on entrance stands in for the "wink" beat instead — reasoning is
 * the same as the tail-curl substitution in the loading-screen redesign
 * (see docs/UPDATED_DESIGN_MD.md).
 */
const CONFETTI = [
  { left: '18%', delay: '0ms', color: 'bg-brand' },
  { left: '32%', delay: '60ms', color: 'bg-lime' },
  { left: '46%', delay: '20ms', color: 'bg-signature' },
  { left: '58%', delay: '110ms', color: 'bg-brand' },
  { left: '70%', delay: '40ms', color: 'bg-lime' },
  { left: '82%', delay: '90ms', color: 'bg-signature' },
];

export default function CompletionState() {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : 'hidden'}
      animate="visible"
      variants={REVEAL_MASK}
      className="glass-surface relative overflow-hidden rounded-card p-4 text-center shadow-glow-high"
    >
      {!reduced && (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center" aria-hidden="true">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className={`absolute top-2 h-2 w-1 rounded-sm ${c.color} animate-confetti-fall`}
              style={{ left: c.left, animationDelay: c.delay }}
            />
          ))}
        </div>
      )}

      <div className="relative mx-auto mb-2 h-14 w-14">
        <div className={`absolute h-14 w-14 rounded-full bg-brand/25 blur-xl ${reduced ? '' : 'animate-glow-pulse'}`} aria-hidden="true" />
        <div className={reduced ? 'h-14 w-14' : 'h-14 w-14 animate-pop-in'}>
          <Chameleon state="celebrating" animated={!reduced} />
        </div>
      </div>

      <p className="flex items-center justify-center gap-1.5 text-card font-semibold text-ink-primary">
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 10.5 8 15l8-10" />
        </svg>
        Form completed
      </p>
      <p className="mt-1 text-caption italic text-ink-muted">Humans shouldn&apos;t type the same thing twice.</p>
    </motion.div>
  );
}

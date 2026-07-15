import { motion } from 'motion/react';
import { STAGGER_CONTAINER, STAGGER_ITEM } from '../MotionSystem/motion.js';
import { useReducedMotion } from '../MotionSystem/useReducedMotion.js';

/*
 * Entrance choreography for the review-card list. ReviewFlow keeps its own
 * `.map()`, keys, and props exactly as they were — this only wraps the
 * output: `<StaggerContainer><StaggerItem key={q.id}><ReviewCard .../>
 * </StaggerItem>…</StaggerContainer>`.
 *
 * StaggerItem deliberately does NOT set its own `initial`/`animate` props —
 * framer-motion propagates the container's "hidden"/"visible" state down to
 * children that only declare `variants`, which is what makes the stagger
 * timing (STAGGER_CONTAINER's `staggerChildren`) apply per-item instead of
 * needing to be computed by hand here.
 */
export function StaggerContainer({ children, className = '' }) {
  const reduced = useReducedMotion();
  return (
    <motion.div initial={reduced ? false : 'hidden'} animate="visible" variants={STAGGER_CONTAINER} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children }) {
  return <motion.div variants={STAGGER_ITEM}>{children}</motion.div>;
}

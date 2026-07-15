import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring } from 'motion/react';

/*
 * Shared motion vocabulary for extension-ui. One place for spring physics,
 * stagger timing, and reveal-mask variants so every component in this
 * redesign moves like the same product instead of five components each
 * picking their own duration/easing.
 *
 * Deliberately NOT generic fade/scale-on-hover (the brief calls these out
 * specifically as the pattern to avoid): entrances use a reveal mask
 * (clip-path, directional) or a spring pop, hover uses magnetic pointer
 * tracking, not a flat scale(1.05).
 */

// Three spring feels, reused across every animated component here instead of
// each hand-picking stiffness/damping. "snappy" = buttons/interactive
// feedback, "settle" = card/panel entrances, "gentle" = ambient/idle motion.
export const SPRING = {
  snappy: { type: 'spring', stiffness: 420, damping: 28, mass: 0.6 },
  settle: { type: 'spring', stiffness: 260, damping: 24, mass: 0.8 },
  gentle: { type: 'spring', stiffness: 120, damping: 20, mass: 1 },
};

// Stagger container/item pair for framer-motion's `variants` API. Direction
// is downward + slightly rightward (a "reveal from the mascot" feel, not a
// generic upward fade) — used by ReviewAnimations/StaggerList for the review
// card list and by WaitingState for its pipeline steps.
export const STAGGER_CONTAINER = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

export const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 10, x: -4 },
  visible: { opacity: 1, y: 0, x: 0, transition: SPRING.settle },
};

// Reveal mask: a clip-path wipe rather than an opacity fade — used for the
// hero card and completion card's entrance. Reads as "unveiled," not
// "faded in."
export const REVEAL_MASK = {
  hidden: { clipPath: 'inset(0 0 100% 0 round 12px)', opacity: 0.4 },
  visible: {
    clipPath: 'inset(0 0 0% 0 round 12px)',
    opacity: 1,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

// Directional slide-in for the pipeline sequence's arrows/steps — motion
// with a direction, not a generic fade.
export const DIRECTIONAL_STEP = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: SPRING.settle },
};

const MAGNETIC_STRENGTH = 0.28;
const MAGNETIC_MAX = 10; // px — how far the button can be pulled off-center

// Magnetic pointer-follow: the element leans toward the cursor within its own
// bounds, spring-eased, and springs back to center on leave. Returns motion
// values to bind to a <motion.div style={{x, y}}> — never touches DOM layout
// directly, so it can't fight React's own rendering.
export function useMagnetic(ref, { disabled = false } = {}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING.snappy);
  const springY = useSpring(y, SPRING.snappy);

  useEffect(() => {
    const el = ref.current;
    if (!el || disabled) return undefined;

    function onMove(e) {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      x.set(Math.max(-MAGNETIC_MAX, Math.min(MAGNETIC_MAX, relX * MAGNETIC_STRENGTH)));
      y.set(Math.max(-MAGNETIC_MAX, Math.min(MAGNETIC_MAX, relY * MAGNETIC_STRENGTH)));
    }
    function onLeave() {
      x.set(0);
      y.set(0);
    }

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [ref, disabled, x, y]);

  return { x: springX, y: springY };
}

// A ref-stable "has this mounted before" flag — lets a component skip its
// entrance animation on re-render (e.g. ExtractButton re-rendering on every
// keystroke elsewhere in the panel) while still playing it on first mount.
export function useHasMounted() {
  const ref = useRef(false);
  useEffect(() => {
    ref.current = true;
  }, []);
  return ref;
}

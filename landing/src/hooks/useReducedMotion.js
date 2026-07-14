import { useEffect, useState } from 'react';

// Reactive prefers-reduced-motion. Drives whether Lenis + GSAP scroll
// storytelling initializes at all. Defaults to `false` so the rich experience
// is the baseline, flipping to `true` only when the user has explicitly asked
// the OS for reduced motion.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    // addEventListener is the modern API; older Safari used addListener.
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  return reduced;
}

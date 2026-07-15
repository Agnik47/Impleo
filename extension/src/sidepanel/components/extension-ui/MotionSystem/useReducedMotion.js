import { useEffect, useState } from 'react';

// Reactive prefers-reduced-motion — identical implementation to landing/src/
// hooks/useReducedMotion.js. Every decorative animation added by this
// redesign (mascot breathing/orbit, background particles, ripple, confetti,
// stagger entrances) is gated on this, not just the CSS media-query fallback
// in index.css, so it never mounts a motion component at all rather than
// mounting one and hoping the CSS override neutralizes it.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  return reduced;
}

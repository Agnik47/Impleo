import { useRef } from 'react';
import gsap from 'gsap';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect.js';
import { useReducedMotion } from './useReducedMotion.js';

// Scoped GSAP setup helper. Runs `setup(gsapInstance, scopeEl)` inside a
// gsap.context() bound to a ref, so every tween/ScrollTrigger created is
// automatically reverted on unmount (no leaked triggers between route/section
// remounts). Skips entirely when the user prefers reduced motion — callers are
// responsible for rendering content in its final, visible state by default so
// nothing is gated behind the animation.
//
// Returns the scope ref to spread onto the container element.
export function useGsap(setup, deps = []) {
  const scope = useRef(null);
  const reduced = useReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (reduced || !scope.current) return undefined;
    const ctx = gsap.context((self) => setup(gsap, scope.current, self), scope);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...deps]);

  return scope;
}

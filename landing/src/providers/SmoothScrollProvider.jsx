import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '../hooks/useReducedMotion.js';

gsap.registerPlugin(ScrollTrigger);

const SmoothScrollContext = createContext({ lenis: null, scrollTo: () => {} });

// Owns the single Lenis instance and wires it to GSAP ScrollTrigger:
//   - lenis.on('scroll', ScrollTrigger.update)  → triggers stay in sync
//   - gsap.ticker drives lenis.raf              → one rAF loop, not two
//   - ScrollTrigger.refresh() after mount        → correct start/end positions
// When reduced-motion is on, Lenis is NOT created: native scrolling is used and
// scrollTo falls back to the browser's instant/anchored jump.
export function SmoothScrollProvider({ children }) {
  const reduced = useReducedMotion();
  const lenisRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (reduced) {
      // Ensure any triggers created elsewhere still measure correctly.
      ScrollTrigger.refresh();
      return undefined;
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo-out
      smoothWheel: true,
      syncTouch: false, // native momentum on touch — better mobile feel + perf
    });
    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const onTick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    setReady(true);
    // Let sections mount + register their triggers, then measure.
    const refresh = requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      cancelAnimationFrame(refresh);
      gsap.ticker.remove(onTick);
      lenis.destroy();
      lenisRef.current = null;
      setReady(false);
    };
  }, [reduced]);

  // -72 clears the 64px fixed nav (h-16) with a little breathing room. Both
  // paths below MUST apply it: scrollIntoView has no offset option, and
  // block:'start' parks the section's heading directly under the nav bar.
  const NAV_OFFSET = -72;

  const scrollTo = (target, opts) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: NAV_OFFSET, ...opts });
      return;
    }
    // Reduced motion: Lenis was never created, so scroll natively — by hand,
    // not via scrollIntoView, so the nav offset still applies.
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY + NAV_OFFSET,
      behavior: 'auto',
    });
  };

  return (
    <SmoothScrollContext.Provider value={{ lenis: lenisRef.current, scrollTo, ready }}>
      {children}
    </SmoothScrollContext.Provider>
  );
}

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}

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

  const scrollTo = (target, opts) => {
    if (lenisRef.current) lenisRef.current.scrollTo(target, { offset: -72, ...opts });
    else if (typeof target === 'string') {
      document.querySelector(target)?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
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

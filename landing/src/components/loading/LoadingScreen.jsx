import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { DURATION, EASE } from '../../motion/tokens.js';
import { useAppReadiness } from './useAppReadiness.js';
import LoadingMascot from './LoadingMascot.jsx';
import LoadingProgress from './LoadingProgress.jsx';
import LoadingCounter from './LoadingCounter.jsx';
import LoadingStatus from './LoadingStatus.jsx';
import './loading.css';

const MIN_VISIBLE_MS = 3000;
const MESSAGE_INTERVAL_MS = 1100;
// Per-frame convergence rate of the displayed number toward its target — the
// exponential-chase shape this produces (fast at first, decelerating as it
// nears target) IS the "fluid, non-linear" counter the brief asks for; there
// is no separate easing curve applied on top of it.
const CHASE_RATE = 0.09;

const MESSAGES = [
  'Scanning forms…',
  'Preparing your copilot…',
  'Teaching the chameleon your preferences…',
  'Loading local AI context…',
  'Ready to automate paperwork…',
];

// The only raster asset worth gating on: the favicon/nav/footer mark. hero.png
// in public/ is unreferenced anywhere in src (verified before writing this),
// so it's left alone rather than preloaded for no reason.
const CRITICAL_IMAGES = ['/chameleon.png'];

// Mirrors the exact expo-out shape SmoothScrollProvider.jsx already uses for
// Lenis's scroll easing (not imported — that one is a Lenis-specific inline
// option, not an exported util). Reusing the same curve here means the
// loader's pacing FEELS like the same product as the scroll experience it
// hands off to, rather than an unrelated third easing.
function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/*
 * Wraps the app (see main.jsx) rather than gating its render: `children`
 * mount immediately, underneath this opaque overlay, so the readiness
 * signals in useAppReadiness.js are tracking the REAL app, not a stand-in —
 * and so there is nothing left to mount/paint once the overlay lifts (no
 * layout shift, no flash of unstyled content).
 *
 * Pacing contract, enforced structurally rather than by two separate hacks
 * that could drift out of sync:
 *   target = min(realProgress, timeCeiling(elapsed, MIN_VISIBLE_MS))
 * `displayed` can never exceed `target`, so it can never exceed real
 * progress either — "never fake completion" holds by construction. Once
 * MIN_VISIBLE_MS has elapsed, timeCeiling saturates at 100 and stops being
 * the binding term, so `displayed` simply tracks real progress live for
 * however much longer it takes — "continue showing real progress" past 3s.
 */
export default function LoadingScreen({ children }) {
  const reduced = useReducedMotion();
  const { realProgress } = useAppReadiness({ images: CRITICAL_IMAGES });

  const [displayed, setDisplayed] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [phase, setPhase] = useState('loading'); // loading | exiting | done

  const realProgressRef = useRef(realProgress);
  useEffect(() => {
    realProgressRef.current = realProgress;
  }, [realProgress]);

  const containerRef = useRef(null);
  const startRef = useRef(null);

  useEffect(() => {
    if (startRef.current == null) startRef.current = performance.now();
    let rafId;
    let value = 0;

    function tick(now) {
      const elapsed = now - startRef.current;
      const ceiling = easeOutExpo(Math.min(elapsed / MIN_VISIBLE_MS, 1)) * 100;
      const target = Math.min(realProgressRef.current, ceiling);

      value += (target - value) * CHASE_RATE;
      if (target - value < 0.15) value = target;
      setDisplayed(value);

      const nextMessageIndex = Math.min(Math.floor(elapsed / MESSAGE_INTERVAL_MS), MESSAGES.length - 1);
      setMessageIndex((prev) => (prev === nextMessageIndex ? prev : nextMessageIndex));

      if (value >= 99.95 && realProgressRef.current >= 100) {
        setPhase((prev) => (prev === 'loading' ? 'exiting' : prev));
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Locks body scroll while the overlay covers the viewport, released the
  // instant it's gone — nothing left over for Lenis (SmoothScrollProvider) to
  // disagree with once the story becomes interactive.
  useEffect(() => {
    if (phase === 'done') return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'exiting') return undefined;
    const el = containerRef.current;
    if (!el || reduced) {
      setPhase('done');
      return undefined;
    }
    const tween = gsap.to(el, {
      opacity: 0,
      scale: 1.03,
      duration: DURATION.slow,
      ease: EASE.premium,
      onComplete: () => setPhase('done'),
    });
    return () => tween.kill();
  }, [phase, reduced]);

  return (
    <>
      {phase !== 'done' && (
        <div
          ref={containerRef}
          aria-busy="true"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 overflow-hidden bg-surface-bg px-6"
        >
          <div className="jungle-radial pointer-events-none absolute inset-0" aria-hidden="true" />
          <LoaderParticles reduced={reduced} />

          <LoadingMascot reduced={reduced} />

          <div className="flex w-full max-w-[280px] flex-col items-center gap-4">
            <LoadingCounter value={displayed} />
            <LoadingProgress value={displayed} />
            <LoadingStatus message={MESSAGES[messageIndex]} reduced={reduced} />
          </div>
        </div>
      )}
      {children}
    </>
  );
}

// A handful of slow-drifting motes reusing the SAME float-slow/float-slower
// keyframes the jungle scenery already uses elsewhere (tailwind.config.js) —
// the loader deliberately does not introduce a second "ambient particle"
// language of its own.
function LoaderParticles({ reduced }) {
  if (reduced) return null;
  const dots = [
    { top: '18%', left: '20%', size: 5, delay: '0s', slow: true },
    { top: '70%', left: '16%', size: 4, delay: '0.6s', slow: false },
    { top: '26%', left: '82%', size: 6, delay: '0.2s', slow: false },
    { top: '76%', left: '80%', size: 4, delay: '1s', slow: true },
    { top: '48%', left: '90%', size: 3, delay: '0.4s', slow: true },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={i}
          className={`absolute rounded-full bg-lime/40 ${d.slow ? 'animate-float-slow' : 'animate-float-slower'}`}
          style={{ top: d.top, left: d.left, width: d.size, height: d.size, animationDelay: d.delay }}
        />
      ))}
    </div>
  );
}

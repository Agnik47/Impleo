import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion.js';

/*
 * The gate in front of the R3F canopy.
 *
 * The scene is an enhancement, never a requirement: assets/jungle/JungleLayers
 * (SVG) and LeafField (2D canvas) already render the jungle for everyone. This
 * only adds true 3D depth where it's free to do so.
 *
 * Because CanopyScene is behind React.lazy, three + @react-three/fiber are a
 * separate chunk that is requested ONLY when all four gates pass — so phones
 * and reduced-motion users never pay a byte for it, which is what keeps the
 * Lighthouse/mobile targets intact while still shipping WebGL on desktop:
 *
 *   1. not prefers-reduced-motion  — a drifting canopy is exactly what that
 *                                    setting is asking us not to do
 *   2. viewport >= 1024px          — proxy for "has the GPU headroom and a
 *                                    pointer to drive the camera parallax"
 *   3. WebGL actually available    — R3F throws on Canvas creation otherwise,
 *                                    which would take the hero down with it
 *   4. hero is on screen           — pauses the render loop once scrolled past
 *
 * NOTE: @react-three/fiber is pinned to v8 in package.json. v9 requires React
 * 19 and this app is on React 18.3 — upgrading fiber without React will break
 * the build.
 */
const CanopyScene = lazy(() => import('../assets/jungle/CanopyScene.jsx'));

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!window.WebGLRenderingContext && !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

export default function HeroCanopy() {
  const reduced = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const ref = useRef(null);

  useEffect(() => {
    if (reduced || !window.matchMedia) {
      setEnabled(false);
      return undefined;
    }
    const mq = window.matchMedia('(min-width: 1024px)');
    // WebGL is probed once, lazily, and only if the size gate already passed —
    // no throwaway context on phones.
    const update = () => setEnabled(mq.matches && hasWebGL());
    update();
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, [reduced]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  return (
    // The wrapper always renders so the IntersectionObserver has something to
    // observe; only the scene itself is gated.
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {enabled && (
        // fallback={null}: the SVG/2D jungle is already painted underneath, so
        // there is nothing to spin on while the chunk arrives.
        <Suspense fallback={null}>
          <CanopyScene active={onScreen} />
        </Suspense>
      )}
    </div>
  );
}

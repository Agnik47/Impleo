import { useEffect, useState } from 'react';

/*
 * Real application-readiness tracking — nothing fabricated. Each signal below
 * is something the browser can genuinely confirm has finished, weighted so
 * the returned 0-100 number is monotonic and never claims more progress than
 * has actually happened:
 *
 *   fonts    document.fonts.ready   — Geist Variable finished loading
 *   images   decode()               — critical raster assets have PIXELS
 *                                     ready to paint, not just bytes fetched
 *   document window 'load'          — every sub-resource the browser knows
 *                                     about (css/js/img) has finished
 *   mounted  double-rAF after mount — the tree beneath the loader has
 *                                     committed AND the browser has painted
 *                                     it at least once (there is no router in
 *                                     this app, so "the app is on screen" is
 *                                     the honest stand-in for "route ready")
 *
 * LoadingScreen is responsible for how this number is PACED onto the screen
 * (its time-ceiling logic); this hook only ever reports the truth.
 */
const WEIGHTS = {
  fonts: 30,
  images: 25,
  document: 25,
  mounted: 20,
};

function useSignal(promiseFactory, deps) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    promiseFactory().then(() => {
      if (!cancelled) setDone(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return done;
}

function fontsReady() {
  if (typeof document === 'undefined' || !document.fonts?.ready) {
    // API unsupported (old Safari) — there's nothing we can honestly wait on,
    // so this signal resolves immediately rather than hanging forever.
    return Promise.resolve();
  }
  return document.fonts.ready;
}

function imagesDecoded(srcs) {
  if (!srcs.length) return Promise.resolve();
  return Promise.all(
    srcs.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          if (img.decode) {
            // decode() resolves once pixels are ready to paint — a stronger,
            // more honest guarantee than 'load', which only means bytes
            // arrived. Never rejects the overall signal: a broken image
            // shouldn't hang the loader forever.
            img.decode().then(resolve, resolve);
          } else {
            img.onload = resolve;
            img.onerror = resolve;
          }
        })
    )
  );
}

function documentComplete() {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
}

function paintedOnce() {
  // Double rAF: the first callback fires before the browser paints the frame
  // this render committed; the second fires after. That gap is what makes
  // "mounted" mean "actually visible," not just "React finished calling
  // render" — a subtle but real difference for a signal that's supposed to
  // mean the app is truly ready.
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

export function useAppReadiness({ images = [] } = {}) {
  const fonts = useSignal(fontsReady, []);
  const imgs = useSignal(() => imagesDecoded(images), [images.join('|')]);
  const doc = useSignal(documentComplete, []);
  const mounted = useSignal(paintedOnce, []);

  const realProgress =
    (fonts ? WEIGHTS.fonts : 0) +
    (imgs ? WEIGHTS.images : 0) +
    (doc ? WEIGHTS.document : 0) +
    (mounted ? WEIGHTS.mounted : 0);

  return { realProgress, isReady: fonts && imgs && doc && mounted };
}

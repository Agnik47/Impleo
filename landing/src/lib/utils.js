// Tiny classNames joiner (no clsx dependency — keeps the bundle lean).
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Linear interpolation — used by the leaf-field canvas and parallax math.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// SSR-safe reduced-motion check for one-off reads (hooks use the reactive
// version). The landing site is client-rendered, but guarding `window` keeps
// this safe if it's ever imported in a non-DOM context.
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

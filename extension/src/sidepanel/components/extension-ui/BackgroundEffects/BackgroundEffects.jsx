import { useReducedMotion } from '../MotionSystem/useReducedMotion.js';

/*
 * The panel's ambient backdrop — replaces the flat `bg-surface-bg` void with
 * a jungle gradient, a faint rotating light ray, a handful of drifting
 * particles, and a film-grain texture.
 *
 * CPU budget: everything here is a CSS `transform`/`opacity` keyframe (see
 * tailwind.config.js's `ray-sweep`/`particle-drift`), which the browser
 * compositor runs on the GPU without touching layout or paint on every
 * frame. There is deliberately no canvas, no requestAnimationFrame loop, and
 * no per-frame JS at all — a side panel that's open all day can't afford a
 * persistent JS animation loop just for ambiance. `will-change: transform`
 * hints the browser to promote these layers once, up front.
 *
 * Fixed + inset-0 + pointer-events-none + a negative z-index-equivalent
 * (rendered first, siblings stack above via normal flow) so it never
 * intercepts clicks or scrolls with the real UI.
 */
// Class names are written out in full below (not built as `animate-${kind}`
// template literals) because Tailwind's JIT scanner greps source files for
// complete literal class strings — a dynamically-constructed name is
// invisible to it and would silently compile to no animation at all.
const ANIMATE_CLASS = {
  'float-slow': 'animate-float-slow',
  'float-slower': 'animate-float-slower',
  'particle-drift': 'animate-particle-drift',
};

const PARTICLES = [
  { top: '8%', left: '14%', size: 4, kind: 'float-slow', delay: '0s' },
  { top: '22%', left: '82%', size: 3, kind: 'particle-drift', delay: '0.6s' },
  { top: '48%', left: '6%', size: 5, kind: 'float-slower', delay: '1.1s' },
  { top: '64%', left: '90%', size: 3, kind: 'float-slow', delay: '0.3s' },
  { top: '86%', left: '30%', size: 4, kind: 'particle-drift', delay: '1.4s' },
  { top: '38%', left: '58%', size: 3, kind: 'float-slower', delay: '0.8s' },
];

export default function BackgroundEffects() {
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="jungle-radial absolute inset-0" />

      {!reduced && (
        <div
          className="absolute left-1/2 top-[-40%] h-[140%] w-[140%] -translate-x-1/2 animate-ray-sweep opacity-[0.06] will-change-transform"
          style={{
            background:
              'conic-gradient(from 90deg, transparent 0deg, rgba(166,217,26,0.5) 25deg, transparent 70deg, transparent 360deg)',
          }}
        />
      )}

      {!reduced &&
        PARTICLES.map((p, i) => (
          <span
            key={i}
            className={`absolute rounded-full bg-lime/40 will-change-transform ${ANIMATE_CLASS[p.kind]}`}
            style={{ top: p.top, left: p.left, width: p.size, height: p.size, animationDelay: p.delay }}
          />
        ))}

      <div className="noise-texture absolute inset-0" />
    </div>
  );
}

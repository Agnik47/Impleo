import Chameleon from '../../assets/mascot/Chameleon.jsx';

/*
 * Reuses the shared Chameleon.jsx mascot UNMODIFIED (state="discovering" —
 * the existing eyes-open, scanning pose with its "radar" accessory, the
 * closest of the six shipped states to "reading a form"). No new mascot
 * geometry was added to that shared component; everything here is either a
 * wrapper animation around it or independent decoration next to it.
 *
 * "Tail curling," from the brief's visual ideas, is deliberately NOT a
 * literal path animation: doing that would mean touching Chameleon.jsx's
 * SVG, which the task explicitly puts out of bounds. The breathing
 * scale+sway on the wrapper below reads as the same kind of organic,
 * weight-shifting motion without bolting a second, disconnected tail
 * fragment onto a component that isn't ours to edit — see docs/DESIGN.md's
 * loading-experience section for the reasoning.
 */
const ORBIT_ITEMS = [
  { angle: 0, kind: 'field' },
  { angle: 72, kind: 'check' },
  { angle: 144, kind: 'field' },
  { angle: 216, kind: 'field' },
  { angle: 288, kind: 'check' },
];

const ORBIT_RADIUS = 64;

// Orbiting glyphs are two shapes only: a form-field bar and a checkmark —
// the product's own extract → review → approve loop, in miniature, circling
// the mascot while it "thinks."
function OrbitGlyph({ kind }) {
  if (kind === 'check') {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-signature" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="8" fill="currentColor" opacity="0.16" />
        <path d="M4.5 8.2 7 10.5 11.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return <span className="block h-1.5 w-5 rounded-full bg-lime/70" aria-hidden="true" />;
}

export default function LoadingMascot({ reduced }) {
  return (
    <div className="relative flex h-[168px] w-[168px] items-center justify-center">
      <div
        className={`absolute h-28 w-28 rounded-full bg-lime/25 blur-2xl ${reduced ? '' : 'animate-glow-pulse'}`}
        aria-hidden="true"
      />

      {!reduced && (
        <div className="loader-orbit-ring absolute inset-0" aria-hidden="true">
          {ORBIT_ITEMS.map((item) => (
            <div
              key={item.angle}
              className="absolute left-1/2 top-1/2 h-0 w-0"
              style={{ transform: `rotate(${item.angle}deg) translateX(${ORBIT_RADIUS}px)` }}
            >
              <div className="loader-orbit-counter">
                <OrbitGlyph kind={item.kind} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={`h-20 w-20 drop-shadow-[0_0_24px_rgba(166,217,26,0.35)] ${reduced ? '' : 'loader-breathe'}`}>
        <Chameleon state="discovering" animated={!reduced} />
      </div>
    </div>
  );
}

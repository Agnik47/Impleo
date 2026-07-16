import { cn } from '../../lib/utils.js';

/*
 * Impleo mascot, reproduced faithfully from the existing chameleon face
 * (green body, white eyes, dark pupils, curved smile — the exact geometry of
 * the shipped logo/thumbnail) and POSED into the six story states. This is not
 * a redesign: the character, proportions, and features are unchanged; only the
 * eyelids, pupil direction, mouth curve, and a small per-state accessory move.
 * Brand colors from Impleo Design System v2.
 *
 * Decorative — always aria-hidden; the surrounding section carries the meaning.
 */

const GREEN = '#28C94E';
const GREEN_2 = '#00A050';
const LIME = '#A6D91A';
const JUNGLE = '#002B2B';
const WHITE = '#F5F5F5';
const YELLOW = '#F5D000';

// Per-state pose data: pupil offset (scanning direction), how open the eyes are
// (eyelid), the mouth path, and whether to show an accessory.
//
// Any pose added here must ALSO be listed in MASCOT_STATES (providers/
// MascotProvider.jsx) or the provider drops it, and given a caption in
// PersistentMascot.jsx — otherwise the companion renders with an empty bubble.
const POSE = {
  sleeping: { px: 0, py: 0, lid: 0.85, mouth: 'M78,132 Q100,140 122,132', accent: 'zzz' },
  discovering: { px: 2, py: -3, lid: 0, mouth: 'M84,130 Q100,138 116,130', accent: 'scan' },
  filling: { px: 0, py: 1, lid: 0.1, mouth: 'M80,131 Q100,142 120,131', accent: 'tongue' },
  approving: { px: 0, py: 1, lid: 0.35, mouth: 'M80,130 Q100,150 120,130', accent: 'check' },
  protecting: { px: 0, py: 0, lid: 0.15, mouth: 'M82,132 Q100,140 118,132', accent: 'shield' },
  celebrating: { px: 0, py: -1, lid: 0, mouth: 'M76,128 Q100,158 124,128', accent: 'spark' },
  // Q&A — eyes up and off to one side (the universal "thinking it over" look),
  // with a small, unsure mouth rather than the confident grin.
  questioning: { px: 3, py: -3, lid: 0.05, mouth: 'M86,133 Q100,127 114,133', accent: 'question' },
  // Contribute — looking down at the seedling it's tending, warm and settled.
  planting: { px: -1, py: 3, lid: 0.3, mouth: 'M82,130 Q100,147 118,130', accent: 'seedling' },
};

export default function Chameleon({ state = 'sleeping', className = '', animated = true }) {
  const pose = POSE[state] || POSE.sleeping;
  // Eyelid as a scaleY of the eye white from the top; 0 = wide open, 1 = shut.
  const lidY = 72 + pose.lid * 22; // eye top ~72, height ~22

  return (
    <svg
      viewBox="0 0 200 200"
      className={cn('h-full w-full overflow-visible', className)}
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <radialGradient id="mascot-body" cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor={LIME} />
          <stop offset="55%" stopColor={GREEN} />
          <stop offset="100%" stopColor={GREEN_2} />
        </radialGradient>
        <clipPath id="eye-l">
          <circle cx="80" cy="90" r="20" />
        </clipPath>
        <clipPath id="eye-r">
          <circle cx="120" cy="90" r="22" />
        </clipPath>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="100" cy="176" rx="46" ry="8" fill={JUNGLE} opacity="0.35" />

      {/* curled tail — a chameleon signature, static spiral */}
      <path
        d="M150,140 q22,4 20,-18 q-2,-16 -18,-14 q-12,1 -11,12 q1,8 9,7 q6,-1 5,-6"
        fill="none"
        stroke={GREEN_2}
        strokeWidth="7"
        strokeLinecap="round"
      />

      {/* body */}
      <circle cx="100" cy="100" r="70" fill="url(#mascot-body)" />
      {/* subtle crest bumps along the head */}
      <path
        d="M62,52 q6,-10 12,0 q6,-10 12,0 q6,-10 12,0"
        fill="none"
        stroke={LIME}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* eyes: white, pupil, then an eyelid rect that drops for sleepy/squint */}
      {[
        { cx: 80, cy: 90, r: 20, clip: 'eye-l' },
        { cx: 120, cy: 90, r: 22, clip: 'eye-r' },
      ].map((eye) => (
        <g key={eye.clip} clipPath={`url(#${eye.clip})`}>
          <circle cx={eye.cx} cy={eye.cy} r={eye.r} fill={WHITE} />
          <circle
            className={animated ? 'transition-transform duration-300 ease-out' : ''}
            cx={eye.cx + pose.px * 2}
            cy={eye.cy + pose.py * 2}
            r={eye.r * 0.5}
            fill={JUNGLE}
          />
          <circle cx={eye.cx + pose.px * 2 - 3} cy={eye.cy + pose.py * 2 - 3} r="2.4" fill={WHITE} />
          {/* eyelid */}
          <rect
            x={eye.cx - eye.r - 2}
            y={eye.cy - eye.r - 2}
            width={eye.r * 2 + 4}
            height={lidY - (eye.cy - eye.r)}
            fill={GREEN}
            className={animated && pose.lid < 0.3 ? 'origin-top animate-blink' : ''}
          />
        </g>
      ))}

      {/* mouth */}
      <path d={pose.mouth} fill="none" stroke={JUNGLE} strokeWidth="4" strokeLinecap="round" />

      {/* ---- per-state accessories ---- */}
      {pose.accent === 'zzz' && (
        <g fill={LIME} opacity="0.9" className={animated ? 'animate-float-slow' : ''}>
          <text x="150" y="60" fontSize="16" fontWeight="700">z</text>
          <text x="162" y="46" fontSize="20" fontWeight="700">Z</text>
        </g>
      )}
      {pose.accent === 'tongue' && (
        <path d="M100,140 q3,14 0,22" stroke={YELLOW} strokeWidth="5" strokeLinecap="round" fill="none" />
      )}
      {pose.accent === 'check' && (
        <g className={animated ? 'animate-check-pop' : ''}>
          <circle cx="150" cy="150" r="16" fill={YELLOW} />
          <path d="M143,150 l5,5 9,-10" fill="none" stroke={JUNGLE} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {pose.accent === 'shield' && (
        <g>
          <path d="M150,132 l14,5 v10 q0,12 -14,17 q-14,-5 -14,-17 v-10 z" fill={GREEN} stroke={LIME} strokeWidth="2.5" />
          <path d="M143,150 l5,5 9,-11" fill="none" stroke={WHITE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {pose.accent === 'spark' && (
        <g fill={YELLOW} className={animated ? 'animate-glow-pulse' : ''}>
          <path d="M150,40 l3,7 7,3 -7,3 -3,7 -3,-7 -7,-3 7,-3 z" />
          <path d="M44,64 l2,5 5,2 -5,2 -2,5 -2,-5 -5,-2 5,-2 z" opacity="0.8" />
          <path d="M168,96 l2,5 5,2 -5,2 -2,5 -2,-5 -5,-2 5,-2 z" opacity="0.7" />
        </g>
      )}
      {pose.accent === 'scan' && (
        <g stroke={LIME} strokeWidth="3" fill="none" opacity="0.85" className={animated ? 'animate-float-slow' : ''}>
          <circle cx="152" cy="66" r="11" />
          <path d="M160,74 l8,8" strokeLinecap="round" />
        </g>
      )}
      {/* Two question marks drifting off the head — same trick as the sleeping
          'zzz', so the two "thought bubble" states read as one family. */}
      {pose.accent === 'question' && (
        <g fill={YELLOW} className={animated ? 'animate-float-slow' : ''}>
          <text x="146" y="58" fontSize="30" fontWeight="700">?</text>
          <text x="40" y="72" fontSize="17" fontWeight="700" opacity="0.65">?</text>
        </g>
      )}
      {/* A seedling by the chameleon's feet — placed right of the ground shadow
          (which spans x≈54–146) and below the tail curl, so it sits in clear
          space rather than on top of the character. */}
      {pose.accent === 'seedling' && (
        <g className={animated ? 'animate-float-slow' : ''}>
          <path d="M156,175 v-23" stroke={GREEN_2} strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M156,158 q13,-3 15,-17 q-15,2 -15,17 z" fill={LIME} />
          <path d="M156,165 q-11,-3 -13,-14 q13,2 13,14 z" fill={GREEN} />
        </g>
      )}
    </svg>
  );
}

import { cn } from '../../lib/utils.js';

/*
 * Layered jungle scenery for parallax depth. Each layer carries [data-parallax]
 * (depth) so animations/parallax.js can move it at a depth-proportional rate.
 * Pure SVG silhouettes in brand greens at low opacity — decorative, aria-hidden,
 * pointer-events-none, and cheap (no raster). Sits behind section content.
 *
 * `edge` controls which frond set anchors the composition:
 *   'top'    canopy leaves hang from the top
 *   'bottom' undergrowth rises from the bottom
 *   'both'   both (used on the tall hero)
 */
export default function JungleLayers({ edge = 'both', className = '' }) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      {/* far mist / glow */}
      <div
        data-parallax="0.25"
        className="absolute -inset-x-10 top-0 h-full jungle-radial opacity-80"
      />

      {(edge === 'top' || edge === 'both') && (
        <svg
          data-parallax="0.55"
          className="absolute -top-6 left-0 w-full text-jungle"
          viewBox="0 0 1440 260"
          fill="currentColor"
          preserveAspectRatio="xMidYMin slice"
        >
          <g opacity="0.9">
            {/* hanging fronds */}
            <path d="M120,0 C140,70 90,120 130,190 C160,120 200,70 170,0 Z" />
            <path d="M300,0 C330,90 270,140 320,220 C360,140 400,80 360,0 Z" opacity="0.7" />
            <path d="M620,0 C650,80 600,130 645,205 C690,130 720,70 690,0 Z" opacity="0.85" />
            <path d="M980,0 C1010,90 960,150 1005,225 C1050,150 1080,80 1050,0 Z" opacity="0.7" />
            <path d="M1280,0 C1310,70 1260,120 1305,195 C1350,120 1380,60 1350,0 Z" opacity="0.9" />
          </g>
        </svg>
      )}

      {/* mid vines */}
      <svg
        data-parallax="-0.4"
        className="absolute left-0 top-1/4 w-full text-brand/10"
        viewBox="0 0 1440 400"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        preserveAspectRatio="xMidYMid slice"
      >
        <path d="M0,40 C300,120 500,-20 760,80 C1040,190 1200,40 1440,120" />
        <path d="M0,220 C260,300 520,160 820,260 C1120,360 1260,220 1440,300" opacity="0.6" />
      </svg>

      {(edge === 'bottom' || edge === 'both') && (
        <svg
          data-parallax="-0.7"
          className="absolute bottom-0 left-0 w-full text-jungle"
          viewBox="0 0 1440 240"
          fill="currentColor"
          preserveAspectRatio="xMidYMax slice"
        >
          <g opacity="0.95">
            <path d="M80,240 C70,160 130,120 100,40 C60,120 20,160 40,240 Z" />
            <path d="M360,240 C350,140 420,90 380,20 C330,100 290,150 320,240 Z" opacity="0.75" />
            <path d="M760,240 C750,150 820,100 780,30 C730,110 690,160 720,240 Z" opacity="0.85" />
            <path d="M1120,240 C1110,140 1180,90 1140,20 C1090,100 1050,150 1080,240 Z" opacity="0.7" />
            <path d="M1360,240 C1350,160 1410,120 1380,40 C1340,120 1300,160 1320,240 Z" opacity="0.9" />
          </g>
        </svg>
      )}
    </div>
  );
}

const TICKS = 5;

/*
 * "Form completion" is the visual metaphor, not a generic percentage bar:
 * the fill reuses the brand's one allowed gradient (`.chameleon-line`, index.
 * css — the same green→lime→yellow used for the hero accent/CTA), and the
 * five ticks below it echo the product's own field-by-field approval flow
 * rather than being an arbitrary decoration.
 *
 * Width is driven directly by `value` with no CSS transition: LoadingScreen
 * already produces a smoothed, eased number every animation frame, so a
 * second CSS-level smoothing on top of it would only add lag.
 */
export default function LoadingProgress({ value }) {
  const pct = Math.max(0, Math.min(100, value));
  const nearDone = pct > 94;

  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={`${Math.round(pct)}% loaded`}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-border/60"
      >
        <div className="chameleon-line h-full rounded-full" style={{ width: `${pct}%` }} />
        {nearDone && (
          <span
            className="absolute -top-[3px] flex h-3 w-3 animate-check-pop items-center justify-center rounded-full bg-signature text-jungle"
            style={{ left: `calc(${pct}% - 6px)` }}
            aria-hidden="true"
          >
            <svg viewBox="0 0 12 12" className="h-2 w-2" fill="none">
              <path d="M2.5 6.2 5 8.5 9.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>

      <div className="mt-2 flex justify-between px-0.5" aria-hidden="true">
        {Array.from({ length: TICKS }).map((_, i) => {
          const threshold = ((i + 1) / TICKS) * 100;
          const lit = pct >= threshold - 2;
          return (
            <span
              key={i}
              className={`h-1 w-1 rounded-full transition-colors duration-300 ${lit ? 'bg-lime' : 'bg-surface-border'}`}
            />
          );
        })}
      </div>
    </div>
  );
}

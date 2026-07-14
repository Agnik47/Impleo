// Purely visual — the accessible number lives on LoadingProgress's
// role="progressbar" (aria-valuenow/aria-valuetext). Rendering the same
// number a second time as its own live region would double-announce it to
// screen readers on every frame, so this one is aria-hidden.
export default function LoadingCounter({ value }) {
  const pct = Math.round(Math.max(0, Math.min(100, value)));
  return (
    <div className="flex items-baseline gap-0.5 tabular-nums" aria-hidden="true">
      <span className="chameleon-text text-display-md font-bold">{pct}</span>
      <span className="text-[15px] font-semibold text-ink-secondary">%</span>
    </div>
  );
}

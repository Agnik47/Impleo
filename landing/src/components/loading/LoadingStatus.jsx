// role="status" scopes the aria-live region to JUST this line (updates
// roughly every 1.1s — a reasonable announcement cadence), rather than the
// whole loader, which would otherwise re-announce the counter on every
// animation frame. `key={message}` remounts the node on each change so the
// existing `reveal-up` keyframe (tailwind.config.js — already used for card
// reveals elsewhere) replays as a small per-message "pop," reused rather
// than reinvented.
export default function LoadingStatus({ message, reduced }) {
  return (
    <p
      key={message}
      role="status"
      className={`text-center text-[13px] text-ink-secondary ${reduced ? '' : 'animate-reveal-up'}`}
    >
      {message}
    </p>
  );
}

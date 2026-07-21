import { useId, useRef, useState } from "react";
import { motion } from "motion/react";
import { useReducedMotion } from "../MotionSystem/useReducedMotion.js";

/*
 * The panel's one primary action, redesigned as a "Linear command button":
 * glass surface, soft brand glow, magnetic pointer-follow, a click ripple,
 * and — the part that replaces two separate StatusLine widgets — its own
 * in-place progress states, so the same button that says "Extract form from
 * this page" becomes the thing telling you it's working, rather than
 * disappearing in favor of an unrelated spinner line.
 *
 * Same contract as the raw <button onClick={handleExtract}> it replaces:
 * one required onClick, nothing about ReviewFlow's phase state machine
 * changes. `phase` is read-only here — it only decides which of four
 * presentational states to render.
 */
const COPY = {
  idle: "Pull Form into Impleo",
  extracting: "Extracting…",
  generating: "Reading the form…",
  error: "Try again",
};

export default function ExtractButton({ phase, onClick, className = "" }) {
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const [ripples, setRipples] = useState([]);
  const rippleId = useId();
  const rippleCount = useRef(0);

  const busy = phase === "extracting" || phase === "generating";
  const isError = phase === "error";
  // Magnetic pointer-follow removed to prevent hover translate animation

  function handlePointerDown(e) {
    if (busy || reduced) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    rippleCount.current += 1;
    const id = `${rippleId}-${rippleCount.current}`;
    setRipples((prev) => [
      ...prev,
      { id, x: e.clientX - rect.left, y: e.clientY - rect.top },
    ]);
  }

  function clearRipple(id) {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      onPointerDown={handlePointerDown}
      disabled={busy}
      className={[
        "group relative w-full overflow-hidden rounded-btn px-3 py-2.5 text-body font-medium",
        "border transition-colors duration-150",
        "shadow-[0_0_0_1px_rgba(40,201,78,0.16),0_0_28px_-8px_rgba(40,201,78,0.5)]",
        "disabled:cursor-default",
        isError
          ? "border-red-500/30 bg-surface-card text-red-300 hover:bg-surface-card-hover"
          : "border-brand/30 bg-brand text-jungle hover:bg-brand-hover",
        busy ? "text-ink-primary" : "",
        className,
      ].join(" ")}
    >
      {/* Glass sheen layer — sits above the solid fill so the button reads as
          "glass over brand color," not a flat block, without sacrificing the
          text-contrast of a solid idle state. */}
      <span
        className="pointer-events-none absolute inset-0 bg-white/[0.06] backdrop-blur-[1px]"
        aria-hidden="true"
      />

      {/* Progress shimmer — a moving highlight band, not a spinner, so the
          button itself visibly "works" rather than handing off to a
          separate status widget. */}
      {busy && !reduced && (
        <span
          className="pointer-events-none absolute inset-0 animate-shimmer bg-[length:200%_100%]"
          style={{
            backgroundImage:
              "linear-gradient(100deg, transparent 35%, rgba(255,255,255,0.28) 50%, transparent 65%)",
          }}
          aria-hidden="true"
        />
      )}

      {!reduced &&
        ripples.map((r) => (
          <span
            key={r.id}
            onAnimationEnd={() => clearRipple(r.id)}
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-ripple-out rounded-full bg-white/50"
            style={{ left: r.x, top: r.y }}
            aria-hidden="true"
          />
        ))}

      <span className="relative flex items-center justify-center gap-2">
        {busy && (
          <span
            className="h-1.5 w-1.5 shrink-0 animate-glow-pulse rounded-full bg-current"
            aria-hidden="true"
          />
        )}
        {COPY[phase] ?? COPY.idle}
      </span>
    </motion.button>
  );
}

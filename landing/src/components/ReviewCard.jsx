import { useEffect, useState } from 'react';
import { cn } from '../lib/utils.js';
import ConfidenceBadge from './ConfidenceBadge.jsx';
import ApprovalCheck from './ApprovalCheck.jsx';

/*
 * A faithful mock of the in-product ReviewCard — the heart of the product story:
 * AI drafts the answer, a confidence badge is shown, and nothing is written
 * until the user Accepts / Edits / Regenerates / Skips. Reusable across the hero,
 * review section, and floating cards.
 *
 * - `autoAccept` plays the Accept tick once after a beat (respects reduced-motion
 *   through the global CSS override on the keyframe).
 * - Controlled `accepted` can be passed by GSAP-driven parents (e.g. the review
 *   section flips it at a scroll beat) — if provided it wins over internal state.
 */
export default function ReviewCard({
  question = 'Why do you want to attend this hackathon?',
  answer = 'I want to ship something real alongside people who move fast. I have been building AI tooling solo for a year, and I learn most when forced to defend design choices in a room — this is exactly that room.',
  confidence = 'high',
  autoAccept = false,
  accepted: acceptedProp,
  className = '',
}) {
  const [acceptedState, setAcceptedState] = useState(false);
  const accepted = acceptedProp ?? acceptedState;

  useEffect(() => {
    if (!autoAccept || acceptedProp !== undefined) return undefined;
    const t = setTimeout(() => setAcceptedState(true), 1100);
    return () => clearTimeout(t);
  }, [autoAccept, acceptedProp]);

  return (
    <div
      className={cn(
        'w-full rounded-card border bg-surface-card p-4 shadow-soft transition-colors duration-200',
        accepted ? 'border-brand/60' : 'border-surface-border',
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
          Review answer
        </span>
        <ConfidenceBadge level={confidence} />
      </div>

      <p className="mb-2 text-[13px] font-semibold text-ink-primary">{question}</p>

      <p className="mb-4 rounded-input border border-surface-border bg-surface-bg p-3 text-[13px] leading-relaxed text-ink-secondary">
        {answer}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAcceptedState(true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-btn px-3 py-1.5 text-[13px] font-semibold transition duration-150 ease-premium',
            accepted
              ? 'bg-brand text-surface-bg'
              : 'border border-surface-border text-ink-primary hover:bg-surface-card-hover'
          )}
        >
          {accepted && <ApprovalCheck active size="sm" className="!h-4 !w-4 !bg-transparent !text-signature" />}
          {accepted ? 'Accepted' : 'Accept'}
        </button>
        {['Edit', 'Regenerate'].map((t) => (
          <button
            key={t}
            type="button"
            className="rounded-btn border border-surface-border px-3 py-1.5 text-[13px] font-medium text-ink-secondary transition duration-150 ease-premium hover:bg-surface-card-hover hover:text-ink-primary"
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          className="rounded-btn px-3 py-1.5 text-[13px] font-medium text-ink-muted transition duration-150 ease-premium hover:text-ink-secondary"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

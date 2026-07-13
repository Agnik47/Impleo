import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';

// A styled mock of the real in-product ReviewCard. Sells the core promise:
// AI drafts the answer, a confidence badge is shown, and nothing is written
// until the user Accepts/Edits/Regenerates/Skips. The Accept tick auto-plays
// once (respecting reduced-motion via the global CSS override).
const CONFIDENCE = {
  high: { label: 'High confidence', className: 'bg-brand/15 text-brand' },
  medium: { label: 'Medium confidence', className: 'bg-signature/15 text-signature' },
  low: { label: 'Low confidence', className: 'bg-ink-muted/15 text-ink-muted' },
};

export default function ReviewCardMock({
  question = 'Why do you want to attend this hackathon?',
  answer = 'I want to ship something real alongside people who move fast. I have been building AI tooling solo for a year, and I learn most when I am forced to defend design choices in a room — this is exactly that room.',
  confidence = 'high',
  autoAccept = true,
}) {
  const [accepted, setAccepted] = useState(false);
  const badge = CONFIDENCE[confidence];

  useEffect(() => {
    if (!autoAccept) return;
    const t = setTimeout(() => setAccepted(true), 1100);
    return () => clearTimeout(t);
  }, [autoAccept]);

  return (
    <div className="w-full rounded-card border border-surface-border bg-surface-card p-4 shadow-soft">
      {/* header: label + confidence */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
          Review answer
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* question */}
      <p className="mb-2 text-[13px] font-semibold text-ink-primary">{question}</p>

      {/* generated answer */}
      <p className="mb-4 rounded-input border border-surface-border bg-surface-bg p-3 text-[13px] leading-relaxed text-ink-secondary">
        {answer}
      </p>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAccepted(true)}
          className={`inline-flex items-center gap-1.5 rounded-btn px-3 py-1.5 text-[13px] font-semibold transition duration-150 ease-premium ${
            accepted
              ? 'bg-brand text-surface-bg'
              : 'border border-surface-border text-ink-primary hover:bg-surface-card-hover'
          }`}
        >
          {accepted && (
            <span className="animate-check-pop text-signature">
              <Icon name="check" className="h-4 w-4" />
            </span>
          )}
          {accepted ? 'Accepted' : 'Accept'}
        </button>
        <button
          type="button"
          className="rounded-btn border border-surface-border px-3 py-1.5 text-[13px] font-medium text-ink-secondary transition duration-150 ease-premium hover:bg-surface-card-hover hover:text-ink-primary"
        >
          Edit
        </button>
        <button
          type="button"
          className="rounded-btn border border-surface-border px-3 py-1.5 text-[13px] font-medium text-ink-secondary transition duration-150 ease-premium hover:bg-surface-card-hover hover:text-ink-primary"
        >
          Regenerate
        </button>
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

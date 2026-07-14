import { cn } from '../lib/utils.js';

// Confidence pill mirroring the in-product badge (high=green, medium=yellow,
// low=muted), each on a 15%-opacity tint of itself — per LANDING_PAGE.md §6.
const STYLES = {
  high: { label: 'High confidence', cls: 'bg-brand/15 text-brand' },
  medium: { label: 'Medium confidence', cls: 'bg-signature/15 text-signature' },
  low: { label: 'Low confidence', cls: 'bg-ink-muted/15 text-ink-muted' },
};

export default function ConfidenceBadge({ level = 'high', className = '' }) {
  const s = STYLES[level] || STYLES.high;
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[12px] font-semibold', s.cls, className)}>
      {s.label}
    </span>
  );
}

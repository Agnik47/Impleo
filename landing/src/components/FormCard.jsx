import { cn } from '../lib/utils.js';

/*
 * A small floating "form field" card — the raw application questions that drift
 * through the story. Two moods:
 *   - 'empty'  : an unanswered field (used in the chaos section) — muted, blank
 *                input line, faint red "required" tick.
 *   - 'filled' : Impleo has drafted an answer — green accent line, text present.
 * Deliberately lighter than ReviewCard so a cluster of them reads as "forms",
 * not a wall of full review UI.
 */
export default function FormCard({ label, value, mood = 'empty', required = true, className = '', style }) {
  const filled = mood === 'filled';
  return (
    <div
      style={style}
      className={cn(
        'w-[220px] shrink-0 rounded-card border bg-surface-card/95 p-3.5 shadow-soft backdrop-blur-sm',
        filled ? 'border-brand/40' : 'border-surface-border',
        className
      )}
    >
      <div className="mb-2 flex items-center gap-1">
        <span className="text-[12px] font-medium text-ink-secondary">{label}</span>
        {required && (
          <span className={cn('text-[12px]', filled ? 'text-brand' : 'text-signature')}>*</span>
        )}
      </div>
      {filled ? (
        <p className="rounded-input border border-brand/20 bg-brand/5 px-2.5 py-1.5 text-[12px] leading-snug text-ink-primary">
          {value}
        </p>
      ) : (
        <div className="h-7 rounded-input border border-dashed border-surface-border bg-surface-bg/60" />
      )}
    </div>
  );
}

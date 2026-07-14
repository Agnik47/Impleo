import { cn } from '../lib/utils.js';
import { Icon } from './Icon.jsx';

// Dynamic approval checkmark — the signature-yellow tick used whenever an answer
// is approved. `active` drives the pop (via the shared check-pop keyframe).
export default function ApprovalCheck({ active = false, size = 'md', className = '' }) {
  const dims = size === 'lg' ? 'h-8 w-8' : size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full',
        dims,
        active ? 'bg-signature text-jungle animate-check-pop' : 'bg-surface-card-hover text-ink-muted',
        className
      )}
    >
      <Icon name="check" className="h-[60%] w-[60%]" />
    </span>
  );
}

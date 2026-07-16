import { useEffect, useRef, useState } from 'react';
import Chameleon from '../assets/mascot/Chameleon.jsx';
import { useMascot } from '../providers/MascotProvider.jsx';
import { useActiveSection } from '../hooks/useActiveSection.js';
import { cn } from '../lib/utils.js';

// Short caption per state — quiet storytelling, desktop only. Every state in
// MASCOT_STATES needs an entry here or the bubble renders empty.
const CAPTION = {
  sleeping: 'zzz…',
  discovering: 'found a form',
  filling: 'drafting answers',
  approving: 'you approve',
  protecting: 'data stays local',
  celebrating: 'submitted!',
  questioning: 'any questions?',
  planting: 'grow it with me',
};

/*
 * The persistent chameleon companion. Fixed to the lower-left, it travels with
 * the reader down the whole page and changes expression as each story section
 * takes over (state comes from MascotProvider via IntersectionObserver in each
 * section). A brief scale "hop" plays on every state change. Hidden on small
 * screens (keeps mobile clean + fast); decorative, so aria-hidden.
 */
export default function PersistentMascot() {
  const { state } = useMascot();
  const active = useActiveSection();
  const [hop, setHop] = useState(false);
  const firstRun = useRef(true);
  // The hero stages the chameleon at full size; the fixed companion would be a
  // second, smaller copy of the same character on screen. So it stands down for
  // the hero and slides in from the left once the story proper begins — which
  // also makes its arrival the first "the chameleon is following you" beat.
  const docked = active === 'hero';

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return undefined;
    }
    setHop(true);
    const t = setTimeout(() => setHop(false), 320);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed bottom-5 left-5 z-40 hidden items-end gap-3 transition-transform duration-500 ease-premium lg:flex',
        docked && '-translate-x-[140%]'
      )}
    >
      <div className="relative">
        {/* lime glow */}
        <div className="absolute inset-0 -z-10 rounded-full bg-lime/25 blur-2xl animate-glow-pulse" />
        {/* The hop and the idle float are separate elements: on one element the
            float keyframe animates transform and takes precedence over the
            transition's transform, so the hop would never be seen. */}
        <div
          className={cn(
            'h-[92px] w-[92px] transition-transform duration-300 ease-premium',
            hop && '-translate-y-2 scale-105'
          )}
        >
          <div className="h-full w-full animate-float-slow">
            <Chameleon state={state} />
          </div>
        </div>
      </div>
      <span className="mb-3 rounded-full border border-surface-border bg-surface-card/80 px-2.5 py-1 text-[11px] font-medium text-ink-secondary backdrop-blur-sm">
        {CAPTION[state]}
      </span>
    </div>
  );
}

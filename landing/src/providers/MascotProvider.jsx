import { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react';

// Shared state for the persistent chameleon journey. Each story section, on
// scroll-enter, calls setMascotState('discovering' | 'filling' | ...). The
// PersistentMascot component reads it and morphs. Kept in context (not prop
// drilling) because the mascot lives in the layout, above the sections.
const MascotContext = createContext({
  state: 'sleeping',
  setMascotState: () => {},
});

// Whitelist — setMascotState silently ignores anything not listed here, so a
// new pose in Chameleon.jsx MUST be registered in this array or it will never
// reach the mascot. Keep in sync with POSE in assets/mascot/Chameleon.jsx.
export const MASCOT_STATES = [
  'sleeping',
  'discovering',
  'filling',
  'approving',
  'protecting',
  'celebrating',
  'questioning',
  'planting',
];

export function MascotProvider({ children }) {
  const [state, setState] = useState('sleeping');
  // Guard against redundant re-renders when the same state fires repeatedly
  // from overlapping ScrollTriggers.
  const current = useRef('sleeping');

  const setMascotState = useCallback((next) => {
    if (!next || next === current.current || !MASCOT_STATES.includes(next)) return;
    current.current = next;
    setState(next);
  }, []);

  const value = useMemo(() => ({ state, setMascotState }), [state, setMascotState]);
  return <MascotContext.Provider value={value}>{children}</MascotContext.Provider>;
}

export function useMascot() {
  return useContext(MascotContext);
}

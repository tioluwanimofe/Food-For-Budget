import { useEffect } from 'react';

const DURATION_MS = 1000;

// The signature reveal: the box shakes, spins and pops open. About one second,
// tap to skip, and skipped entirely when the phone asks for reduced motion.
export default function MysteryBox({ onDone }) {
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(onDone, reduced ? 0 : DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <button type="button" className="mystery" onClick={onDone} aria-label="Reveal your order">
      <img src="/icon.svg" alt="" width="160" height="160" />
      <span className="hint">tap to skip</span>
    </button>
  );
}

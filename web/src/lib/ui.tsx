import { useEffect, useState, type ReactNode } from 'react';

export function useMedia(query: string): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}
export const useIsMobile = () => useMedia('(max-width: 760px)');

/** Centered dialog on desktop, bottom sheet on mobile. */
export function Sheet({ onClose, children, wide, label }: { onClose?: () => void; children: ReactNode; wide?: boolean; label?: string }) {
  useEffect(() => {
    if (!onClose) return;
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** Mark the body while a game screen is mounted (hides mobile chrome, disables pull-to-refresh). */
export function useInGame(): void {
  useEffect(() => {
    document.body.classList.add('in-game');
    return () => document.body.classList.remove('in-game');
  }, []);
}

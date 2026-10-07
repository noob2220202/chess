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

interface Ask { title: string; body?: string; ok: string; danger?: boolean; resolve: (v: boolean) => void }
let showAsk: ((a: Ask | null) => void) | null = null;

/** In-app replacement for window.confirm. Resolves true when the action is confirmed. */
export function ask(o: { title: string; body?: string; ok: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => (showAsk ? showAsk({ ...o, resolve }) : resolve(window.confirm(o.title))));
}

/** Mount once near the root. */
export function AskHost() {
  const [a, setA] = useState<Ask | null>(null);
  useEffect(() => { showAsk = setA; return () => { showAsk = null; }; }, []);
  if (!a) return null;
  const done = (v: boolean) => { setA(null); a.resolve(v); };
  return (
    <Sheet onClose={() => done(false)} label={a.title}>
      <h2>{a.title}</h2>
      {a.body && <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.6 }}>{a.body}</p>}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn" onClick={() => done(false)}>취소</button>
        <button className={`btn ${a.danger ? 'danger' : 'primary'}`} onClick={() => done(true)} autoFocus>{a.ok}</button>
      </div>
    </Sheet>
  );
}

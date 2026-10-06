import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast { id: number; text: string; kind: 'info' | 'error' }
const Ctx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = Math.random();
    setItems((xs) => [...xs.slice(-2), { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);

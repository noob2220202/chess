import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { load, save } from './storage.ts';

export type BoardTheme = 'sand' | 'moss' | 'ocean' | 'dusk' | 'graphite';
export interface Settings {
  theme: 'dark' | 'light' | 'system';
  board: BoardTheme;
  sound: boolean;
  coords: boolean;
  animate: boolean;
  /** Pulsing hints in the tutorial and card practice. */
  guide: boolean;
}

export const BOARD_THEMES: Array<{ id: BoardTheme; name: string; light: string; dark: string }> = [
  { id: 'sand', name: '모래', light: '#ebdfc8', dark: '#b28a62' },
  { id: 'moss', name: '이끼', light: '#e8ecc9', dark: '#7a9558' },
  { id: 'ocean', name: '바다', light: '#dbe4ea', dark: '#7193ab' },
  { id: 'dusk', name: '황혼', light: '#e6def2', dark: '#8e7cb8' },
  { id: 'graphite', name: '흑연', light: '#cdd0d4', dark: '#6c717b' },
];

const DEFAULTS: Settings = { theme: 'dark', board: 'sand', sound: true, coords: true, animate: true, guide: true };
const KEY = 'aa.settings.v2';

const Ctx = createContext<{ s: Settings; set: (p: Partial<Settings>) => void; open: () => void } | null>(null);

function applyTheme(s: Settings) {
  const root = document.documentElement;
  const dark = s.theme === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : s.theme === 'dark';
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.board = s.board;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1c1f' : '#e8e6e1');
}

export function SettingsProvider({ children, renderModal }: { children: ReactNode; renderModal: (close: () => void) => ReactNode }) {
  const [s, setS] = useState<Settings>(() => ({ ...DEFAULTS, ...load<Partial<Settings>>(KEY, {}) }));
  const [open, setOpen] = useState(false);
  useEffect(() => {
    applyTheme(s);
    save(KEY, s);
    if (s.theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme(s);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [s]);
  return (
    <Ctx.Provider value={{ s, set: (p) => setS((x) => ({ ...x, ...p })), open: () => setOpen(true) }}>
      {children}
      {open && renderModal(() => setOpen(false))}
    </Ctx.Provider>
  );
}

export function useSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('SettingsProvider missing');
  return v;
}

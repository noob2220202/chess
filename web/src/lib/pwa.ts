import { useEffect, useState } from 'react';

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((f) => f()); });
}

export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
export const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Install state: 'prompt' (Android/desktop Chrome), 'ios' (show manual hint), or null. */
export function useInstall(): { mode: 'prompt' | 'ios' | null; install: () => Promise<void> } {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((x) => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  if (isStandalone()) return { mode: null, install: async () => {} };
  if (deferred) return { mode: 'prompt', install: async () => { await deferred!.prompt(); deferred = null; force((x) => x + 1); } };
  if (isIOS()) return { mode: 'ios', install: async () => {} };
  return { mode: null, install: async () => {} };
}

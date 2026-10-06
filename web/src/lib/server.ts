import { load, remove, save } from './storage.ts';

const KEY = 'aa.server';

/** True inside the Android/iOS app shell (Capacitor). */
export const isNative = (): boolean => !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

function clean(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Base URL of the game server. Empty string means "same origin" (the web build served by the server itself).
 * Order: user override in settings → VITE_SERVER_URL baked in at build time → same origin.
 */
export function serverBase(): string {
  const custom = load<string | null>(KEY, null);
  if (custom) return clean(custom);
  return clean(import.meta.env.VITE_SERVER_URL ?? '');
}

export function customServer(): string { return load<string | null>(KEY, null) ?? ''; }

export function setCustomServer(url: string): void {
  const v = clean(url);
  if (v) save(KEY, /^https?:\/\//.test(v) ? v : `https://${v}`);
  else remove(KEY);
}

/** True when there is a server to talk to (always on the web; the app needs a configured URL). */
export function hasServer(): boolean {
  return serverBase() !== '' || !isNative();
}

export function wsUrl(): string {
  const base = serverBase();
  if (base) return base.replace(/^http/, 'ws') + '/ws';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

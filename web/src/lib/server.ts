/** True inside the Android/iOS app shell (Capacitor). */
export const isNative = (): boolean => !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

/**
 * Base URL of the game server, baked in at build time from web/.env.production (VITE_SERVER_URL).
 * The website served by the server itself talks to its own origin.
 */
export function serverBase(): string {
  if (!isNative()) return '';
  return (import.meta.env.VITE_SERVER_URL ?? '').trim().replace(/\/+$/, '');
}

/** True when there is a server to talk to (always on the web; the app needs a built-in address). */
export function hasServer(): boolean {
  return serverBase() !== '' || !isNative();
}

export function wsUrl(): string {
  const base = serverBase();
  if (base) return base.replace(/^http/, 'ws') + '/ws';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/** Emit sw.js with the list of built assets to precache (offline play, tutorial, encyclopedia). */
function serviceWorker(): Plugin {
  return {
    name: 'augment-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const version = Date.now().toString(36);
      const precache = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png',
        ...['w', 'b'].flatMap((c) => ['P', 'N', 'B', 'R', 'Q', 'K'].map((t) => `/pieces/${c}${t}.svg`)),
        ...files.map((f) => '/' + f)];
      const src = `const CACHE = 'augment-${version}';
const PRECACHE = ${JSON.stringify(precache)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/ws') return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && url.pathname.startsWith('/assets/')) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  })));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  resolve: { alias: { '@engine': fileURLToPath(new URL('../engine/src/index.ts', import.meta.url)) } },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:8080', '/ws': { target: 'ws://localhost:8080', ws: true } },
  },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 900 },
});

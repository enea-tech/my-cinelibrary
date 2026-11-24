/* My CineLibrary — service worker: tiene l'app sul telefono così funziona anche senza internet.
   Versione e elenco dei file vengono inseriti da build.mjs. I dati dei film NON passano da qui: stanno in IndexedDB. */
const CACHE = 'cinelibrary-73d7ed2a15';
const FILES = ["./","index.html","app.js","style.css","manifest.webmanifest","fonts/bodoni-latin-500-italic.woff2","fonts/bodoni-latin-600-normal.woff2","fonts/bodoni-latin-700-normal.woff2","fonts/bodoni-latin-ext-500-italic.woff2","fonts/bodoni-latin-ext-600-normal.woff2","fonts/bodoni-latin-ext-700-normal.woff2","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('cinelibrary-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = (await cache.match('index.html')) || (await cache.match('./'));
      if (shell) return shell;
    }
    try { return await fetch(req); } catch (err) { return new Response('Non disponibile senza connessione', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
  })());
});

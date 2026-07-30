// Service worker minimo: rende l'app installabile e serve il guscio
// anche senza rete. I dati restano online (Supabase), non finti.
const CACHE = 'corsiapro-v1';
const GUSCIO = ['/', '/index.html', '/manifest.webmanifest', '/icona-192.png', '/icona-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(GUSCIO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;          // Supabase passa sempre dalla rete

  // Navigazioni: prima la rete, in mancanza il guscio in cache.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
    return;
  }

  // Asset: cache, e in parallelo aggiorna.
  e.respondWith(
    caches.match(e.request).then((trovato) => {
      const rete = fetch(e.request)
        .then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put(e.request, r.clone()));
          return r;
        })
        .catch(() => trovato);
      return trovato || rete;
    })
  );
});

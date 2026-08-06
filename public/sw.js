// Service worker minimo: rende l'app installabile e serve il guscio
// anche senza rete. I dati restano online (Supabase), non finti.
const CACHE = 'corsiapro-0.38.0';
const GUSCIO = ['/', '/index.html', '/manifest.webmanifest', '/icona-192.png', '/icona-512.png'];

// I file in /assets/ hanno l'impronta del contenuto nel nome: se il nome è
// quello, il contenuto è quello, per sempre. Quindi stanno in una cache SENZA
// numero di versione, che non si svuota a ogni release. È la metà che serve
// perché la divisione in pezzi paghi davvero: dopo un aggiornamento React e
// Supabase sono già lì, si scarica solo il nostro.
const FILE = 'corsiapro-file';
const TETTO = 60;   // oltre, si buttano i più vecchi

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(GUSCIO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(
        chiavi.filter((k) => k !== CACHE && k !== FILE).map((k) => caches.delete(k))
      ))
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

  // File con l'impronta nel nome: se ce l'ho, è già quello giusto. Nessun
  // controllo in rete, nessuna scadenza.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open(FILE).then(async (c) => {
        const trovato = await c.match(e.request);
        if (trovato) return trovato;
        const r = await fetch(e.request);
        if (r.ok) { await c.put(e.request, r.clone()); potaFile(c); }
        return r;
      })
    );
    return;
  }

  // Tutto il resto: cache, e in parallelo aggiorna.
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

// I file vecchi non danno fastidio, ma non si accumulano per sempre:
// oltre il tetto si buttano i primi entrati.
async function potaFile(cache) {
  const chiavi = await cache.keys();
  if (chiavi.length <= TETTO) return;
  await Promise.all(chiavi.slice(0, chiavi.length - TETTO).map((k) => cache.delete(k)));
}

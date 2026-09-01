/* CINE FINANCE service worker — keeps the installed app (PWA) in sync with the site.
   Strategy: network-first for same-origin requests, so the app always fetches the
   latest version when online, and falls back to cache only when offline.
   Cross-origin requests (CDN libraries, the Anthropic API, Supabase) pass straight
   through and are never intercepted. Bump CACHE (and APP_VERSION in index.html) each deploy. */
const CACHE = 'cine-finance-2026.09.01.1';
const CORE  = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  /* Take over immediately. The old "let the page opt in" behaviour meant an open tab kept
     serving the previous version until it was closed, so shipped changes looked like they had
     never deployed — the owner hit this repeatedly. For a single-user app the cost of a tab
     picking up new code on reload is far smaller than the cost of not trusting the updates. */
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // CDN + API + Supabase untouched
  e.respondWith((async () => {
    try {
      const fresh = await fetch(req, { cache: 'no-store' });
      if (fresh && fresh.status === 200) { const c = await caches.open(CACHE); c.put(req, fresh.clone()); }
      return fresh;
    } catch (err) {
      const cached = await caches.match(req) || (req.mode === 'navigate' ? await caches.match('./index.html') : null);
      if (cached) return cached;
      throw err;
    }
  })());
});

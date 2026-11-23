// CRT Crusaders service worker: keeps the game's files on the phone, so it
// opens fast after the first visit and plays without a connection.
// Built files under assets/ have a hash in their name, so a cached copy never
// goes stale: they are served from the cache first. Everything else (the page
// itself) asks the network first, so a new version arrives as soon as it is out.
const CACHE = 'crt-crusaders-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const keep = (res) => {
    if (res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };
  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(keep)));
  } else {
    e.respondWith(fetch(req).then(keep).catch(() => caches.match(req).then((hit) => hit || caches.match('./'))));
  }
});

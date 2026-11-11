// Service worker for The Bibliotecher (installable web app).
// Everything on this site is fetched network-first and revalidated, so updated images, pages and scripts
// show up on the next load without clearing site data. The cache is only a fallback for offline use.
const CACHE_VERSION = 'em-site-v50';
const APP_SHELL = [
  '/', '/tech/', '/app/', '/suite/', '/audiobooker/', '/converter/', '/dictator/', '/musicker/',
  '/narrator/', '/reader/', '/scanner/', '/translator/', '/typesetter/',
  '/site.css', '/site.js', '/embed.css', '/embed.js', '/sync.js', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.headers.has('range')) return;            // audio/video seeking: let the browser handle it
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // never touch cross-origin requests

  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  // 'no-cache' = always revalidate with the server (cheap 304 when unchanged), so edits appear immediately
  const netReq = isPage ? req : new Request(req, { cache: 'no-cache' });

  event.respondWith(
    fetch(netReq).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, clone)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then((r) => r || (isPage ? caches.match('/app/') : Response.error())))
  );
});

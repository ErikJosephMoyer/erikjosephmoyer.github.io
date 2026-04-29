// Service worker for Erik's Tools PWA
// Bump CACHE_VERSION to invalidate old caches when shipping updates.
const CACHE_VERSION = 'em-tools-v20';
const APP_SHELL = [
  '/app/',
  '/abp/',
  '/ebr/',
  '/fcv/',
  '/ocr/',
  '/msc/',
  '/stt/',
  '/tts/',
  '/tps/',
  '/manifest.json',
  '/images/Favicon.png',
  '/images/Favicon-192.png',
  '/images/Favicon-512.png',
  '/images/Audiobooker.png',
  '/images/Converter.PNG',
  '/images/SpeechToTexter.png',
  '/images/TextToSpeecher.png',
  '/images/Typesetter.PNG',
  '/images/ConverterLogo.PNG',
  '/images/TypesetterLogo.PNG',
  '/images/Logophile.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Add files individually so one bad URL doesn't fail the whole install
      return Promise.all(APP_SHELL.map(url =>
        cache.add(url).catch(err => console.warn('SW: failed to cache', url, err))
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Don't intercept cross-origin requests (HF API, CDNs, fonts) — let them go through normally
  if (url.origin !== location.origin) return;

  // Network-first for HTML navigations so users get fresh updates when online,
  // fall back to cache when offline.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, clone)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('/app/')))
    );
    return;
  }

  // Cache-first for static assets (images, css, js)
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, clone)).catch(() => {});
      }
      return res;
    }))
  );
});

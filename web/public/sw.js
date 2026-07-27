const CACHE_NAME = 'tech-growth-hub-shell-v4';
const SHELL_URLS = ['/manifest.webmanifest', '/app-icon.svg'];

async function fetchAndCache(cache, url) {
  const response = await fetch(new Request(url, { cache: 'reload' }));
  if (!response.ok) throw new Error(`Unable to precache ${url}: ${response.status}`);
  await cache.put(url, response);
}

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(SHELL_URLS.map((url) => fetchAndCache(cache, url)));
  const response = await fetch(new Request('/', { cache: 'reload' }));
  if (!response.ok) throw new Error(`Unable to precache app shell: ${response.status}`);
  await cache.put('/', response.clone());
  const html = await response.text();
  const assetUrls = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)"/g), (match) => match[1]);
  const uniqueAssets = Array.from(new Set(assetUrls));
  if (uniqueAssets.length > 0) {
    await Promise.all(uniqueAssets.map((url) => fetchAndCache(cache, url)));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  if (['script', 'style', 'font', 'image'].includes(request.destination)) {
    event.respondWith(
      caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});

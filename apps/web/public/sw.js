/*
 * SpeakBetter service worker.
 *
 *  - Makes the app installable and shows a friendly page when you are offline.
 *  - Keeps the built files (hashed, so they never change) after the first visit, so the app opens faster.
 *  - Shows push notifications, and opens the right page when one is tapped.
 *  - Offline mode: keeps the last good copy of your learning content (library, grammar, word packs, shadowing) and of
 *    the app itself, so they still open without a connection.
 *
 * The API is only touched for that short list of GET requests, network first; everything else (other API
 * calls, anything that is not a GET) goes straight to the network as before.
 */

const VERSION = 'v2';
const SHELL_CACHE = `sb-shell-${VERSION}`;
const ASSET_CACHE = `sb-assets-${VERSION}`;
const API_CACHE = `sb-api-${VERSION}`;
const OFFLINE_URL = '/offline.html';
/** The last app page that loaded, served when there is no network */
const SHELL_URL = '/__app-shell';

/** The API's origin, passed in when the worker is registered (/sw.js?api=https://api.example.com) */
const API_ORIGIN = (() => {
  try {
    const api = new URL(self.location.href).searchParams.get('api');
    return api ? new URL(api).origin : null;
  } catch {
    return null;
  }
})();

/** API reads worth keeping for offline: who you are, and learning content */
const OFFLINE_API = [
  /^\/auth\/me$/,
  /^\/library(\/[^/]+)?$/,
  /^\/grammar\/lessons(\/[^/]+)?$/,
  /^\/vocab-packs(\/[^/]+)?$/,
  /^\/shadowing(\/[^/]+)?$/,
];
/** How long to wait for the network before using the saved copy */
const API_TIMEOUT_MS = 6000;

const isOfflineApi = (url) => API_ORIGIN !== null && url.origin === API_ORIGIN && OFFLINE_API.some((re) => re.test(url.pathname));

/** Network first; a good answer replaces the saved copy, and the saved copy is used when the network fails */
async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), API_TIMEOUT_MS)),
    ]);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(request, { ignoreVary: true });
    if (saved) return saved;
    throw error;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== SHELL_CACHE && key !== ASSET_CACHE && key !== API_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Learning content from the API: kept for offline use
  if (isOfflineApi(url)) {
    event.respondWith(networkFirst(request));
    return;
  }
  // Anything else on another origin (the rest of the API, fonts...) is not touched
  if (url.origin !== self.location.origin) return;

  // Opening a page: always the network. Offline, the last app page that loaded (so saved lessons still
  // open), or the offline page when there is none.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            // Development pages load their code live from the dev server, so they are useless offline
            const html = await response.clone().text();
            if (!html.includes('/@vite/client')) {
              const shell = await caches.open(SHELL_CACHE);
              await shell.put(SHELL_URL, new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
            }
          }
          return response;
        })
        .catch(async () => (await caches.match(SHELL_URL)) || caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Built files have a hash in their name, so a cached copy is always the right one
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});

/**
 * Shows a notification, unless the app is open and visible: then the in-app bell already shows it (Chrome
 * allows skipping the notification in that case).
 */
async function show(payload, { force = false } = {}) {
  if (!force) {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.some((client) => client.visibilityState === 'visible')) return;
  }
  const title = String(payload.title || 'SpeakBetter').slice(0, 120);
  await self.registration.showNotification(title, {
    body: String(payload.body || '').slice(0, 300),
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    // The same tag replaces an older notification instead of stacking
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    data: { url: typeof payload.url === 'string' ? payload.url : '/dashboard' },
  });
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(show(payload));
});

// The page can ask for a notification directly (used to check how they look), or for the saved API data to
// be wiped (signing out on a shared device)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(show(event.data.payload || {}, { force: true }));
  }
  if (event.data && event.data.type === 'CLEAR_API_CACHE') {
    event.waitUntil(caches.delete(API_CACHE));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Only pages of this app: anything else goes to the dashboard
  let target = new URL('/dashboard', self.location.origin);
  try {
    const wanted = new URL((event.notification.data && event.notification.data.url) || '/dashboard', self.location.origin);
    if (wanted.origin === self.location.origin) target = wanted;
  } catch {
    /* keep the dashboard */
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(target.href);
            } catch {
              /* the page stays where it is */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});

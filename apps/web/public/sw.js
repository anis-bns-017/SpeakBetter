/*
 * SpeakBetter service worker.
 *
 *  - Makes the app installable and shows a friendly page when you are offline.
 *  - Keeps the built files (hashed, so they never change) after the first visit, so the app opens faster.
 *  - Shows push notifications, and opens the right page when one is tapped.
 *
 * It never touches the API: requests to another origin, and anything that is not a GET, go straight to the network.
 */

const VERSION = 'v1';
const SHELL_CACHE = `sb-shell-${VERSION}`;
const ASSET_CACHE = `sb-assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';

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
        if (key !== SHELL_CACHE && key !== ASSET_CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // The API lives on another origin: never cached here
  if (url.origin !== self.location.origin) return;

  // Opening a page: always the network, and the offline page only when there is none
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
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

// The page can ask for a notification directly (used to check how they look)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(show(event.data.payload || {}, { force: true }));
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

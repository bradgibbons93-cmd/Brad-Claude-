/* Yumi's service worker: shows lock-screen notifications and opens the app when one is tapped.
   It doesn't cache anything, so the app is always the latest version. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Yumi', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Yumi', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: '/img/icon-192.png',
    badge: '/img/icon-192.png',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/', self.location.origin);
  if (url.origin !== self.location.origin) return;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === url.origin) {
        w.postMessage({ type: 'open', tab: url.searchParams.get('tab'), sub: url.searchParams.get('sub') });
        return w.focus();
      }
    }
    return self.clients.openWindow(url.pathname + url.search);
  })());
});

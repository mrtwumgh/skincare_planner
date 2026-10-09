const CACHE = 'skin-ritual-v3';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Network first so new deploys from Netlify show up; cache is the offline fallback.
// Requests to the reminder worker (another origin) are never touched.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(m => m || caches.match('index.html')))
  );
});

// The worker sends { title, body, tag }. tag is the routine (am, pm, body), spf for the sunscreen reapply, or test.
self.addEventListener('push', e => {
  let msg = {};
  try { msg = e.data ? e.data.json() : {}; } catch { msg = { body: e.data && e.data.text() }; }
  const tag = msg.tag || 'note';
  e.waitUntil(self.registration.showNotification(msg.title || 'Skin Ritual', {
    body: msg.body || '',
    tag,
    renotify: true,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: { am: './?r=am', pm: './?r=pm', body: './?r=body', spf: './?r=am' }[tag] || './' },
  }));
});

// Tapping a reminder opens the app on that routine, reusing an open window if there is one.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) { await w.focus(); return w.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});

// Auto-update: skip waiting and claim clients immediately
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

// Network-first for navigation — always fetch fresh HTML if online
self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});

// Push notifications
self.addEventListener('push', e => {
  if (!e.data) return;

  let payload;
  try {
    payload = e.data.json();
  } catch {
    payload = { title: '🏎️ F1 Reminder', body: e.data.text() };
  }

  e.waitUntil(
    self.registration.showNotification(payload.title ?? 'F1 Reminder', {
      body: payload.body ?? '',
      icon: '/icon',
      badge: '/icon',
      tag: payload.tag ?? 'f1-reminder',
      data: { url: payload.url ?? '/' },
      requireInteraction: true,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url ?? '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

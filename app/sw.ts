import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';
import { defaultCache } from '@serwist/next/worker';

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,   // wait for user to confirm update via banner
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// Allow the update banner to trigger activation
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: { title?: string; body?: string; tag?: string; url?: string };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'F1 Reminder', body: event.data.text() };
  }

  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: '/icon',
    badge: '/icon',
    tag: payload.tag ?? 'f1-reminder',
    data: { url: payload.url ?? '/' },
    requireInteraction: true,
  };
  // vibrate is not in the TS lib but is supported at runtime
  (options as Record<string, unknown>)['vibrate'] = [200, 100, 200];

  event.waitUntil(self.registration.showNotification(payload.title ?? 'F1 Reminder', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            (client as WindowClient).navigate(url);
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

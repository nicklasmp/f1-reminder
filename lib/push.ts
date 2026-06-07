import webpush from 'web-push';
import { PushSubscriptionData } from '@/types/f1';

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
}

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      JSON.stringify(payload)
    );
    return { success: true };
  } catch (err: unknown) {
    const error = err as { statusCode?: number; message?: string };
    // 410 Gone = subscription expired, should be removed from DB
    if (error.statusCode === 410) {
      return { success: false, error: 'subscription_expired' };
    }
    return { success: false, error: error.message ?? 'unknown' };
  }
}

export function buildWednesdayMessage(raceName: string, country: string): NotificationPayload {
  return {
    title: 'F1 i weekenden!',
    body: `${raceName} kører denne weekend. Sæt dig til rette!`,
    icon: '/icon',
    badge: '/icon',
    tag: 'f1-wednesday',
    url: '/',
  };
}

export function buildSessionMessage(
  sessionLabel: string,
  raceName: string,
  timeStr: string
): NotificationPayload {
  return {
    title: `${sessionLabel} starter snart`,
    body: `${raceName} — ${sessionLabel} begynder kl. ${timeStr}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: `f1-session-${sessionLabel}`,
    url: '/',
  };
}

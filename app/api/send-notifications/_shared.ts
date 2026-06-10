import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendPushNotification, NotificationPayload } from '@/lib/push';
import { PushSubscriptionData } from '@/types/f1';

export function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret');
  return secret === process.env.CRON_SECRET;
}

export async function getSubscriptions(): Promise<{ subs: PushSubscriptionData[]; supabase: ReturnType<typeof getSupabaseAdmin> }> {
  const supabase = getSupabaseAdmin();
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');

  if (error || !subscriptions?.length) {
    return { subs: [], supabase };
  }

  const subs: PushSubscriptionData[] = subscriptions.map(s => ({
    endpoint: s.endpoint,
    keys: { p256dh: s.p256dh, auth: s.auth },
  }));

  return { subs, supabase };
}

export async function sendToAll(
  subs: PushSubscriptionData[],
  payload: NotificationPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  const results = await Promise.allSettled(
    subs.map(sub => sendPushNotification(sub, payload))
  );

  const expired = subs.filter((_, i) => {
    const result = results[i];
    return result.status === 'fulfilled' && result.value.error === 'subscription_expired';
  });

  if (expired.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expired.map(s => s.endpoint));
  }
}

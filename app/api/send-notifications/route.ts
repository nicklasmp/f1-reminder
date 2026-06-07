import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendPushNotification, buildWednesdayMessage, buildSessionMessage } from '@/lib/push';
import { fetchSchedule, formatSessionTime, isF1ThisWeekend } from '@/lib/f1-api';
import { PushSubscriptionData } from '@/types/f1';

// Protect this endpoint with a secret so only cron-job.org can trigger it
function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret');
  return secret === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const schedule = await fetchSchedule('current');
    const nextRace = schedule.find(race => new Date(race.raceDate) >= new Date(now.toDateString()));

    if (!nextRace) {
      return NextResponse.json({ message: 'No upcoming race found' });
    }

    const supabase = getSupabaseAdmin();
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth');

    if (error || !subscriptions?.length) {
      return NextResponse.json({ message: 'No subscribers', error });
    }

    const subs: PushSubscriptionData[] = subscriptions.map(s => ({
      endpoint: s.endpoint,
      keys: { p256dh: s.p256dh, auth: s.auth },
    }));

    const nowHour = now.getUTCHours();
    const nowDay = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 3=Wed
    const notifications: Array<{ title: string; body: string }> = [];

    // --- Wednesday reminder ---
    // cron-job.org should call this every Wednesday at 08:00 CET
    if (nowDay === 3 && isF1ThisWeekend(nextRace)) {
      const payload = buildWednesdayMessage(nextRace.raceName, nextRace.country);
      notifications.push(payload);
      await sendToAll(subs, payload, supabase);
    }

    // --- Session reminders (1 hour before each session) ---
    // cron-job.org should call this every hour during race weekends
    for (const session of nextRace.sessions) {
      // Skip fp1, fp2, fp3 if desired — we include all except nothing
      const sessionStart = new Date(session.time);
      const minutesUntil = (sessionStart.getTime() - now.getTime()) / 60000;

      // Send notification 60 minutes before session
      if (minutesUntil > 55 && minutesUntil <= 65) {
        const timeStr = formatSessionTime(session.time);
        const payload = buildSessionMessage(session.label, nextRace.raceName, timeStr);
        notifications.push(payload);
        await sendToAll(subs, payload, supabase);
      }
    }

    return NextResponse.json({
      success: true,
      race: nextRace.raceName,
      notificationsSent: notifications.length,
      notifications,
    });
  } catch (err) {
    console.error('Send notifications error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendToAll(
  subs: PushSubscriptionData[],
  payload: { title: string; body: string; icon?: string; badge?: string; tag?: string; url?: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  const results = await Promise.allSettled(
    subs.map(sub => sendPushNotification(sub, payload))
  );

  // Clean up expired subscriptions
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

// Allow GET for manual testing
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return POST(req);
}

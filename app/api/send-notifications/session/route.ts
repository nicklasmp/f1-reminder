import { NextRequest, NextResponse } from 'next/server';
import { fetchSchedule, formatSessionTime } from '@/lib/f1-api';
import { buildSessionMessage } from '@/lib/push';
import { isAuthorized, getSubscriptions, sendToAll } from '../_shared';

// Triggered by cron-job.org every hour during race weekends (Fri–Sun)
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

    const notifications: Array<{ title: string; body: string }> = [];

    for (const session of nextRace.sessions) {
      const sessionStart = new Date(session.time);
      const minutesUntil = (sessionStart.getTime() - now.getTime()) / 60000;

      if (minutesUntil > 55 && minutesUntil <= 65) {
        const { subs, supabase } = await getSubscriptions();

        if (subs.length) {
          const timeStr = formatSessionTime(session.time);
          const payload = buildSessionMessage(session.label, nextRace.raceName, timeStr);
          notifications.push(payload);
          await sendToAll(subs, payload, supabase);
        }
      }
    }

    return NextResponse.json({
      success: true,
      race: nextRace.raceName,
      notificationsSent: notifications.length,
      notifications,
    });
  } catch (err) {
    console.error('Session notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return POST(req);
}

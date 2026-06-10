import { NextRequest, NextResponse } from 'next/server';
import { fetchSchedule, isF1ThisWeekend } from '@/lib/f1-api';
import { buildWednesdayMessage } from '@/lib/push';
import { isAuthorized, getSubscriptions, sendToAll } from '../_shared';

// Triggered by cron-job.org every Wednesday at 08:00 CET
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const nowDay = now.getUTCDay(); // 3 = Wednesday

    if (nowDay !== 3) {
      return NextResponse.json({ message: 'Not Wednesday, skipping' });
    }

    const schedule = await fetchSchedule('current');
    const nextRace = schedule.find(race => new Date(race.raceDate) >= new Date(now.toDateString()));

    if (!nextRace || !isF1ThisWeekend(nextRace)) {
      return NextResponse.json({ message: 'No F1 weekend this week, skipping' });
    }

    const { subs, supabase } = await getSubscriptions();

    if (!subs.length) {
      return NextResponse.json({ message: 'No subscribers' });
    }

    const payload = buildWednesdayMessage(nextRace.raceName, nextRace.country);
    await sendToAll(subs, payload, supabase);

    return NextResponse.json({ success: true, race: nextRace.raceName, notification: payload });
  } catch (err) {
    console.error('Weekly notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return POST(req);
}

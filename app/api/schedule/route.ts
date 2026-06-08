import { NextResponse } from 'next/server';
import { fetchSchedule } from '@/lib/f1-api';

export async function GET() {
  try {
    const schedule = await fetchSchedule('current');
    return NextResponse.json({ schedule }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    console.error('Schedule API error:', err);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

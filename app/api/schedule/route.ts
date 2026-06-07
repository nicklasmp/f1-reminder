import { NextResponse } from 'next/server';
import { fetchSchedule } from '@/lib/f1-api';

export async function GET() {
  try {
    const schedule = await fetchSchedule('current');
    return NextResponse.json({ schedule });
  } catch (err) {
    console.error('Schedule API error:', err);
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 });
  }
}

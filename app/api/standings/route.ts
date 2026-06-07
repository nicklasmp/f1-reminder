import { NextResponse } from 'next/server';
import { fetchDriverStandings, fetchConstructorStandings } from '@/lib/f1-api';

export async function GET() {
  try {
    const [drivers, constructors] = await Promise.all([
      fetchDriverStandings('current'),
      fetchConstructorStandings('current'),
    ]);

    return NextResponse.json({ drivers, constructors });
  } catch (err) {
    console.error('Standings API error:', err);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}

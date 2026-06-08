import { NextResponse } from 'next/server';
import { fetchDriverStandings, fetchConstructorStandings } from '@/lib/f1-api';

export async function GET() {
  try {
    const [drivers, constructors] = await Promise.all([
      fetchDriverStandings('current'),
      fetchConstructorStandings('current'),
    ]);
    // Photos and logos are resolved client-side from the F1 CDN
    return NextResponse.json({ drivers, constructors }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    console.error('Standings API error:', err);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}

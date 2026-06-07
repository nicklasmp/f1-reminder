import { NextResponse } from 'next/server';
import { fetchDriverStandings, fetchConstructorStandings } from '@/lib/f1-api';
import { F1DriverStanding } from '@/types/f1';

async function fetchDriverImage(givenName: string, familyName: string): Promise<string | null> {
  try {
    const title = [...givenName.split(' '), familyName].join('_');
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { next: { revalidate: 86400 } } // cache 24h
    );
    if (!res.ok) return null;
    const data = await res.json();
    const src: string | undefined = data?.thumbnail?.source;
    if (!src) return null;
    // Downscale to 80px (Wikipedia serves any width via URL substitution)
    return src.replace(/\/\d+px-/, '/80px-');
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [rawDrivers, constructors] = await Promise.all([
      fetchDriverStandings('current'),
      fetchConstructorStandings('current'),
    ]);

    // Enrich each driver with a Wikipedia headshot
    const drivers: F1DriverStanding[] = await Promise.all(
      rawDrivers.map(async (s) => ({
        ...s,
        imageUrl: await fetchDriverImage(s.driver.givenName, s.driver.familyName),
      }))
    );

    return NextResponse.json({ drivers, constructors });
  } catch (err) {
    console.error('Standings API error:', err);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}

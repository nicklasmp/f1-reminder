import { NextResponse } from 'next/server';
import { fetchDriverStandings, fetchConstructorStandings } from '@/lib/f1-api';
import { F1DriverStanding } from '@/types/f1';

/** Fetch a Wikipedia headshot using the driver's own Wikipedia URL (avoids disambiguation issues) */
async function fetchDriverImage(wikiUrl: string): Promise<string | null> {
  try {
    // Extract page title from URL, e.g. "George_Russell_(racing_driver)"
    const title = decodeURIComponent(wikiUrl.split('/wiki/')[1] ?? '');
    if (!title) return null;

    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const src: string | undefined = data?.thumbnail?.source;
    if (!src) return null;

    // Downscale to 80px via Wikipedia's thumbnail URL pattern
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

    // Enrich each driver with a Wikipedia headshot (parallel, cached 24 h)
    const drivers: F1DriverStanding[] = await Promise.all(
      rawDrivers.map(async (s) => ({
        ...s,
        imageUrl: await fetchDriverImage((s.driver as unknown as Record<string, string>).url ?? ''),
      }))
    );

    return NextResponse.json({ drivers, constructors });
  } catch (err) {
    console.error('Standings API error:', err);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}

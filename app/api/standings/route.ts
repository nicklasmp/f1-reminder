import { NextResponse } from 'next/server';
import { fetchDriverStandings, fetchConstructorStandings } from '@/lib/f1-api';
import { F1DriverStanding, F1ConstructorStanding } from '@/types/f1';

/** Fetch a Wikipedia thumbnail using any Wikipedia page URL */
async function fetchWikiImage(wikiUrl: string): Promise<string | null> {
  try {
    const title = decodeURIComponent(wikiUrl.split('/wiki/')[1] ?? '');
    if (!title) return null;

    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const src: string | undefined = data?.thumbnail?.source;
    return src ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [rawDrivers, rawConstructors] = await Promise.all([
      fetchDriverStandings('current'),
      fetchConstructorStandings('current'),
    ]);

    // Enrich drivers + constructors with Wikipedia images in parallel (cached 24 h)
    const [drivers, constructors] = await Promise.all([
      Promise.all(
        rawDrivers.map(async (s): Promise<F1DriverStanding> => ({
          ...s,
          imageUrl: await fetchWikiImage((s.driver as unknown as Record<string, string>).url ?? ''),
        }))
      ),
      Promise.all(
        rawConstructors.map(async (s): Promise<F1ConstructorStanding> => ({
          ...s,
          imageUrl: await fetchWikiImage((s.constructor as unknown as Record<string, string>).url ?? ''),
        }))
      ),
    ]);

    return NextResponse.json({ drivers, constructors });
  } catch (err) {
    console.error('Standings API error:', err);
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 });
  }
}

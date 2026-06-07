import { NextResponse } from 'next/server';
import { F1RaceResult, F1QualifyingResult } from '@/types/f1';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const round = searchParams.get('round') ?? 'last';
  const type = searchParams.get('type') ?? 'race'; // 'race' | 'qualifying' | 'sprint'

  try {
    const endpoint =
      type === 'qualifying' ? `current/${round}/qualifying.json` :
      type === 'sprint'     ? `current/${round}/sprint.json` :
                              `current/${round}/results.json`;

    const res = await fetch(`${JOLPICA_BASE}/${endpoint}`, { next: { revalidate: 120 } });
    if (!res.ok) return NextResponse.json({ results: null });

    const data = await res.json();
    const raceInfo = data?.MRData?.RaceTable?.Races?.[0];
    if (!raceInfo) return NextResponse.json({ results: null });

    if (type === 'qualifying') {
      const results: F1QualifyingResult[] = (raceInfo.QualifyingResults ?? []).map((r: Record<string, unknown>) => ({
        position: r.position,
        driver: r.Driver,
        constructor: r.Constructor,
        q1: r.Q1,
        q2: r.Q2,
        q3: r.Q3,
      }));
      return NextResponse.json({ results });
    }

    // race or sprint
    const results: F1RaceResult[] = ((type === 'sprint' ? raceInfo.SprintResults : raceInfo.Results) ?? []).map((r: Record<string, unknown>) => ({
      position: r.position,
      positionText: r.positionText,
      points: r.points,
      grid: r.grid,
      laps: r.laps,
      status: r.status,
      time: (r.Time as Record<string, string> | undefined)?.time,
      driver: r.Driver,
      constructor: r.Constructor,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Results API error:', err);
    return NextResponse.json({ results: null });
  }
}

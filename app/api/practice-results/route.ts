import { NextResponse } from 'next/server';
import { F1PracticeResult } from '@/types/f1';

const OPENF1_BASE = 'https://api.openf1.org/v1';
const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

const SESSION_NAME_MAP: Record<string, string> = {
  fp1: 'Practice 1',
  fp2: 'Practice 2',
  fp3: 'Practice 3',
};

function formatLapTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const round = searchParams.get('round') ?? '1';
  const session = searchParams.get('session') ?? 'fp1';

  const sessionName = SESSION_NAME_MAP[session];
  if (!sessionName) return NextResponse.json({ results: null });

  try {
    // 1. Get race info from Jolpica to find country + year
    const raceRes = await fetch(`${JOLPICA_BASE}/current/${round}.json`, {
      next: { revalidate: 3600 },
    });
    const raceData = await raceRes.json();
    const race = raceData?.MRData?.RaceTable?.Races?.[0];
    if (!race) return NextResponse.json({ results: null });

    const year = new Date(race.date).getFullYear();
    const country = race.Circuit?.Location?.country ?? '';

    // 2. Find OpenF1 session key — try country_name first, fall back to year-only + date match
    const raceWeekStart = new Date(race.date);
    raceWeekStart.setDate(raceWeekStart.getDate() - 6); // fp1 is typically thu or fri

    const sessionsRes = await fetch(
      `${OPENF1_BASE}/sessions?session_name=${encodeURIComponent(sessionName)}&year=${year}`,
      { next: { revalidate: 3600 } }
    );

    if (sessionsRes.status === 401) {
      const body = await sessionsRes.json().catch(() => ({}));
      const isLive = String(body?.detail ?? '').includes('Live');
      return NextResponse.json({ results: null, reason: isLive ? 'live_session' : 'auth_required' });
    }

    const allSessions = await sessionsRes.json();
    if (!Array.isArray(allSessions) || allSessions.length === 0) {
      return NextResponse.json({ results: null });
    }

    // Match session closest to race week (same week, same country when possible)
    const countryLower = country.toLowerCase();
    let matched = allSessions.find((s: Record<string, string>) =>
      (s.country_name ?? '').toLowerCase().includes(countryLower) ||
      countryLower.includes((s.country_name ?? '').toLowerCase())
    );
    if (!matched) {
      // Fall back: find session whose date_start is within 7 days before race date
      matched = allSessions.find((s: Record<string, string>) => {
        const d = new Date(s.date_start);
        return d >= raceWeekStart && d <= new Date(race.date + 'T23:59:59Z');
      });
    }
    if (!matched) return NextResponse.json({ results: null });
    const sessionKey = matched.session_key;

    // 3. Fetch laps + driver info in parallel
    const [lapsRes, driversRes] = await Promise.all([
      fetch(`${OPENF1_BASE}/laps?session_key=${sessionKey}`, { next: { revalidate: 300 } }),
      fetch(`${OPENF1_BASE}/drivers?session_key=${sessionKey}`, { next: { revalidate: 3600 } }),
    ]);

    if (lapsRes.status === 401 || driversRes.status === 401) {
      return NextResponse.json({ results: null, reason: 'live_session' });
    }

    const laps = await lapsRes.json();
    const drivers = await driversRes.json();

    if (!Array.isArray(laps) || !Array.isArray(drivers)) {
      return NextResponse.json({ results: null });
    }

    // 4. Find fastest valid lap per driver
    const fastestMap: Record<number, number> = {};
    for (const lap of laps) {
      if (!lap.lap_duration || lap.lap_duration <= 0 || lap.is_pit_out_lap) continue;
      const dn: number = lap.driver_number;
      if (!fastestMap[dn] || lap.lap_duration < fastestMap[dn]) {
        fastestMap[dn] = lap.lap_duration;
      }
    }

    // 5. Build driver lookup
    const driverMap: Record<number, { full_name: string; name_acronym: string; team_name: string }> =
      Object.fromEntries(drivers.map((d: { driver_number: number; full_name: string; name_acronym: string; team_name: string }) => [d.driver_number, d]));

    // 6. Sort and format
    const sorted = Object.entries(fastestMap)
      .map(([dn, lapTime]) => ({ driverNumber: Number(dn), lapTime }))
      .sort((a, b) => a.lapTime - b.lapTime);

    const results: F1PracticeResult[] = sorted.map((entry, i) => {
      const d = driverMap[entry.driverNumber];
      return {
        position: String(i + 1),
        driverNumber: entry.driverNumber,
        fullName: d?.full_name ?? `#${entry.driverNumber}`,
        acronym: d?.name_acronym ?? '???',
        team: d?.team_name ?? '',
        lapTime: formatLapTime(entry.lapTime),
      };
    });

    return NextResponse.json({ results }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('Practice results error:', err);
    return NextResponse.json({ results: null });
  }
}

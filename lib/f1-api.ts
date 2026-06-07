import { F1Race, F1Session, F1DriverStanding, F1ConstructorStanding, F1RaceResult } from '@/types/f1';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';

// Country code mapping for flag emojis
const COUNTRY_FLAGS: Record<string, string> = {
  'Australia': '🇦🇺', 'Bahrain': '🇧🇭', 'Saudi Arabia': '🇸🇦', 'Japan': '🇯🇵',
  'China': '🇨🇳', 'USA': '🇺🇸', 'United States': '🇺🇸', 'Italy': '🇮🇹',
  'Monaco': '🇲🇨', 'Canada': '🇨🇦', 'Spain': '🇪🇸', 'Austria': '🇦🇹',
  'UK': '🇬🇧', 'United Kingdom': '🇬🇧', 'Hungary': '🇭🇺', 'Belgium': '🇧🇪',
  'Netherlands': '🇳🇱', 'Azerbaijan': '🇦🇿', 'Singapore': '🇸🇬', 'Mexico': '🇲🇽',
  'Brazil': '🇧🇷', 'United Arab Emirates': '🇦🇪', 'Qatar': '🇶🇦',
  'Las Vegas': '🇺🇸', 'Miami': '🇺🇸',
};

export function getFlagForCountry(country: string): string {
  return COUNTRY_FLAGS[country] ?? '🏁';
}

// Session label mapping
const SESSION_LABELS: Record<string, string> = {
  fp1: 'Fri. Træning 1',
  fp2: 'Fri. Træning 2',
  fp3: 'Lør. Træning 3',
  qualifying: 'Kvalifikation',
  sprint: 'Sprint',
  sprint_qualifying: 'Sprint Kvalifikation',
  race: 'Race',
};

export function getSessionLabel(type: string): string {
  return SESSION_LABELS[type] ?? type;
}

// Fetch full season schedule
export async function fetchSchedule(season: string = 'current'): Promise<F1Race[]> {
  const res = await fetch(`${JOLPICA_BASE}/${season}.json?limit=30`, {
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!res.ok) throw new Error(`Jolpica schedule fetch failed: ${res.status}`);

  const data = await res.json();
  const races = data?.MRData?.RaceTable?.Races ?? [];

  return races.map((race: Record<string, unknown>): F1Race => {
    const sessions: F1Session[] = [];

    const fp1 = race.FirstPractice as Record<string, string> | undefined;
    const fp2 = race.SecondPractice as Record<string, string> | undefined;
    const fp3 = race.ThirdPractice as Record<string, string> | undefined;
    const sq = race.SprintQualifying as Record<string, string> | undefined;
    const sprint = race.Sprint as Record<string, string> | undefined;
    const qual = race.Qualifying as Record<string, string> | undefined;

    const isSprint = !!(sprint);

    if (fp1?.date) sessions.push({ type: 'fp1', label: SESSION_LABELS.fp1, date: fp1.date, time: `${fp1.date}T${fp1.time ?? '00:00:00Z'}` });
    if (fp2?.date) sessions.push({ type: 'fp2', label: SESSION_LABELS.fp2, date: fp2.date, time: `${fp2.date}T${fp2.time ?? '00:00:00Z'}` });
    if (sq?.date) sessions.push({ type: 'sprint_qualifying', label: SESSION_LABELS.sprint_qualifying, date: sq.date, time: `${sq.date}T${sq.time ?? '00:00:00Z'}` });
    if (sprint?.date) sessions.push({ type: 'sprint', label: SESSION_LABELS.sprint, date: sprint.date, time: `${sprint.date}T${sprint.time ?? '00:00:00Z'}` });
    if (fp3?.date) sessions.push({ type: 'fp3', label: SESSION_LABELS.fp3, date: fp3.date, time: `${fp3.date}T${fp3.time ?? '00:00:00Z'}` });
    if (qual?.date) sessions.push({ type: 'qualifying', label: SESSION_LABELS.qualifying, date: qual.date, time: `${qual.date}T${qual.time ?? '00:00:00Z'}` });

    sessions.push({
      type: 'race',
      label: SESSION_LABELS.race,
      date: race.date as string,
      time: `${race.date}T${race.time ?? '00:00:00Z'}`,
    });

    const circuit = race.Circuit as Record<string, unknown>;
    const location = circuit?.Location as Record<string, string>;

    return {
      round: Number(race.round),
      season: race.season as string,
      raceName: race.raceName as string,
      circuitName: circuit?.circuitName as string,
      locality: location?.locality ?? '',
      country: location?.country ?? '',
      raceDate: race.date as string,
      sessions,
      isSprint,
    };
  });
}

// Get the next upcoming race
export async function fetchNextRace(): Promise<F1Race | null> {
  const schedule = await fetchSchedule('current');
  const now = new Date();

  return schedule.find(race => new Date(race.raceDate) >= now) ?? null;
}

// Get driver standings
export async function fetchDriverStandings(season: string = 'current'): Promise<F1DriverStanding[]> {
  const res = await fetch(`${JOLPICA_BASE}/${season}/driverstandings.json`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Driver standings fetch failed: ${res.status}`);

  const data = await res.json();
  const standings = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];

  return standings.map((s: Record<string, unknown>) => ({
    position: s.position,
    points: s.points,
    wins: s.wins,
    driver: s.Driver,
    constructor: (s.Constructors as Record<string, unknown>[])?.[0],
  }));
}

// Get constructor standings
export async function fetchConstructorStandings(season: string = 'current'): Promise<F1ConstructorStanding[]> {
  const res = await fetch(`${JOLPICA_BASE}/${season}/constructorstandings.json`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Constructor standings fetch failed: ${res.status}`);

  const data = await res.json();
  const standings = data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];

  return standings.map((s: Record<string, unknown>) => ({
    position: s.position,
    points: s.points,
    wins: s.wins,
    constructor: s.Constructor,
  }));
}

// Get race results for a specific round
export async function fetchRaceResults(season: string = 'current', round: string | number = 'last'): Promise<F1RaceResult[]> {
  const res = await fetch(`${JOLPICA_BASE}/${season}/${round}/results.json`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Race results fetch failed: ${res.status}`);

  const data = await res.json();
  const results = data?.MRData?.RaceTable?.Races?.[0]?.Results ?? [];

  return results.map((r: Record<string, unknown>) => ({
    position: r.position,
    positionText: r.positionText,
    points: r.points,
    grid: r.grid,
    laps: r.laps,
    status: r.status,
    time: (r.Time as Record<string, string>)?.time,
    fastestLap: r.FastestLap ? {
      rank: (r.FastestLap as Record<string, unknown>).rank,
      lap: (r.FastestLap as Record<string, unknown>).lap,
      time: ((r.FastestLap as Record<string, unknown>).Time as Record<string, string>)?.time,
    } : undefined,
    driver: r.Driver,
    constructor: r.Constructor,
  }));
}

// Get qualifying results
export async function fetchQualifyingResults(season: string = 'current', round: string | number = 'last') {
  const res = await fetch(`${JOLPICA_BASE}/${season}/${round}/qualifying.json`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Qualifying results fetch failed: ${res.status}`);

  const data = await res.json();
  return data?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults ?? [];
}

// Helper: format a UTC time string to Danish locale time
export function formatSessionTime(utcTime: string, timeZone: string = 'Europe/Copenhagen'): string {
  const date = new Date(utcTime);
  return date.toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
}

export function formatSessionDate(utcTime: string, timeZone: string = 'Europe/Copenhagen'): string {
  const date = new Date(utcTime);
  return date.toLocaleDateString('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  });
}

// Is there an F1 weekend this coming weekend (from now)?
export function isF1ThisWeekend(race: F1Race): boolean {
  const raceDate = new Date(race.raceDate);
  const now = new Date();
  const daysUntilRace = (raceDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilRace >= 0 && daysUntilRace <= 7;
}

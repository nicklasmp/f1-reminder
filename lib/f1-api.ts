import { F1Race, F1Session, F1DriverStanding, F1ConstructorStanding, F1RaceResult } from '@/types/f1';

const JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1';
const F1CALENDAR_BASE = 'https://raw.githubusercontent.com/sportstimes/f1/main/_db/f1';

// Static metadata keyed by f1calendar race name
const RACE_META: Record<string, { country: string; circuitName: string; raceName: string }> = {
  'Australian':          { country: 'Australien',          circuitName: 'Albert Park Circuit',              raceName: 'Australian Grand Prix' },
  'Chinese':             { country: 'Kina',               circuitName: 'Shanghai International Circuit',   raceName: 'Chinese Grand Prix' },
  'Japanese':            { country: 'Japan',              circuitName: 'Suzuka International Racing Course',raceName: 'Japanese Grand Prix' },
  'Bahrain':             { country: 'Bahrain',            circuitName: 'Bahrain International Circuit',    raceName: 'Bahrain Grand Prix' },
  'Saudi Arabian':       { country: 'Saudi-Arabien',      circuitName: 'Jeddah Corniche Circuit',          raceName: 'Saudi Arabian Grand Prix' },
  'Miami':               { country: 'USA',                circuitName: 'Miami International Autodrome',    raceName: 'Miami Grand Prix' },
  'Emilia Romagna':      { country: 'Italien',            circuitName: 'Autodromo Enzo e Dino Ferrari',    raceName: 'Emilia Romagna Grand Prix' },
  'Monaco':              { country: 'Monaco',             circuitName: 'Circuit de Monaco',                raceName: 'Monaco Grand Prix' },
  'Canadian':            { country: 'Canada',             circuitName: 'Circuit Gilles Villeneuve',        raceName: 'Canadian Grand Prix' },
  'Barcelona-Catalunya': { country: 'Spanien',            circuitName: 'Circuit de Barcelona-Catalunya',  raceName: 'Catalan Grand Prix' },
  'Austrian':            { country: 'Østrig',             circuitName: 'Red Bull Ring',                    raceName: 'Austrian Grand Prix' },
  'British':             { country: 'Storbritannien',     circuitName: 'Silverstone Circuit',              raceName: 'British Grand Prix' },
  'Belgian':             { country: 'Belgien',            circuitName: 'Circuit de Spa-Francorchamps',    raceName: 'Belgian Grand Prix' },
  'Hungarian':           { country: 'Ungarn',             circuitName: 'Hungaroring',                      raceName: 'Hungarian Grand Prix' },
  'Dutch':               { country: 'Holland',            circuitName: 'Circuit Zandvoort',                raceName: 'Dutch Grand Prix' },
  'Italian':             { country: 'Italien',            circuitName: 'Autodromo Nazionale Monza',        raceName: 'Italian Grand Prix' },
  'Spanish':             { country: 'Spanien',            circuitName: 'Circuit de Madrid Metropolitano', raceName: 'Spanish Grand Prix' },
  'Azerbaijan':          { country: 'Aserbajdsjan',       circuitName: 'Baku City Circuit',                raceName: 'Azerbaijan Grand Prix' },
  'Singapore':           { country: 'Singapore',          circuitName: 'Marina Bay Street Circuit',        raceName: 'Singapore Grand Prix' },
  'United States':       { country: 'USA',                circuitName: 'Circuit of the Americas',          raceName: 'United States Grand Prix' },
  'Mexican':             { country: 'Mexico',             circuitName: 'Autodromo Hermanos Rodriguez',     raceName: 'Mexican Grand Prix' },
  'Brazilian':           { country: 'Brasilien',          circuitName: 'Autodromo Jose Carlos Pace',       raceName: 'Brazilian Grand Prix' },
  'Las Vegas':           { country: 'USA',                circuitName: 'Las Vegas Strip Circuit',          raceName: 'Las Vegas Grand Prix' },
  'Qatar':               { country: 'Qatar',              circuitName: 'Lusail International Circuit',     raceName: 'Qatar Grand Prix' },
  'Abu Dhabi':           { country: 'Abu Dhabi',          circuitName: 'Yas Marina Circuit',               raceName: 'Abu Dhabi Grand Prix' },
};

// Session label mapping
const SESSION_LABELS: Record<string, string> = {
  fp1: 'Træning 1',
  fp2: 'Træning 2',
  fp3: 'Træning 3',
  qualifying: 'Kvalifikation',
  sprint: 'Sprint',
  sprint_qualifying: 'Sprint Kvalifikation',
  race: 'Race',
};

export function getSessionLabel(type: string): string {
  return SESSION_LABELS[type] ?? type;
}

// Fetch full season schedule — uses f1calendar (GitHub CDN, highly reliable)
export async function fetchSchedule(season: string = 'current'): Promise<F1Race[]> {
  const year = season === 'current' ? new Date().getFullYear() : Number(season);
  const res = await fetch(`${F1CALENDAR_BASE}/${year}.json`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) throw new Error(`f1calendar fetch failed: ${res.status}`);

  const data = await res.json();
  const races: Array<{
    name: string; location: string; round: number;
    sessions: Record<string, string>;
  }> = data.races ?? [];

  return races.map((race): F1Race => {
    const meta = RACE_META[race.name] ?? {
      country: race.location,
      circuitName: race.location,
      raceName: `${race.name} Grand Prix`,
    };

    const s = race.sessions;
    const sessions: F1Session[] = [];

    const add = (type: F1Session['type'], isoTime: string | undefined) => {
      if (!isoTime) return;
      sessions.push({ type, label: SESSION_LABELS[type] ?? type, date: isoTime.split('T')[0], time: isoTime });
    };

    add('fp1', s.fp1);
    add('sprint_qualifying', s.sprintQualifying);
    add('fp2', s.fp2);
    add('fp3', s.fp3);
    add('sprint', s.sprint);
    add('qualifying', s.qualifying);
    add('race', s.gp);

    // Sort chronologically
    sessions.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return {
      round: race.round,
      season: String(year),
      raceName: meta.raceName,
      circuitName: meta.circuitName,
      locality: race.location,
      country: meta.country,
      raceDate: s.gp?.split('T')[0] ?? '',
      sessions,
      isSprint: !!(s.sprint || s.sprintQualifying),
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

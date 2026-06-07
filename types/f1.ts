export interface F1Session {
  type: 'fp1' | 'fp2' | 'fp3' | 'qualifying' | 'sprint' | 'sprint_qualifying' | 'race';
  label: string;
  date: string; // ISO date string
  time: string; // ISO datetime string (UTC)
}

export interface F1Race {
  round: number;
  season: string;
  raceName: string;
  circuitName: string;
  locality: string;
  country: string;
  countryCode?: string;
  raceDate: string; // ISO date string
  sessions: F1Session[];
  isSprint: boolean;
}

export interface F1DriverStanding {
  position: string;
  points: string;
  wins: string;
  driver: {
    driverId: string;
    permanentNumber: string;
    code: string;
    givenName: string;
    familyName: string;
    nationality: string;
  };
  constructor: {
    constructorId: string;
    name: string;
    nationality: string;
  };
}

export interface F1ConstructorStanding {
  position: string;
  points: string;
  wins: string;
  constructor: {
    constructorId: string;
    name: string;
    nationality: string;
  };
}

export interface F1RaceResult {
  position: string;
  positionText: string;
  points: string;
  grid: string;
  laps: string;
  status: string;
  time?: string;
  fastestLap?: {
    rank: string;
    lap: string;
    time: string;
  };
  driver: {
    driverId: string;
    permanentNumber: string;
    code: string;
    givenName: string;
    familyName: string;
    nationality: string;
  };
  constructor: {
    constructorId: string;
    name: string;
  };
}

export interface F1QualifyingResult {
  position: string;
  driver: {
    driverId: string;
    code: string;
    givenName: string;
    familyName: string;
  };
  constructor: {
    constructorId: string;
    name: string;
  };
  q1?: string;
  q2?: string;
  q3?: string;
}

export interface F1PracticeResult {
  position: string;
  driverNumber: number;
  fullName: string;
  acronym: string;
  team: string;
  lapTime: string;
}

export interface F1ResultsData {
  raceName: string;
  round: string;
  season: string;
  country: string;
  raceResults: F1RaceResult[];
  qualifyingResults: F1QualifyingResult[];
}

export interface PushSubscriptionData {
  id?: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  created_at?: string;
}

export type NotificationType =
  | 'wednesday_reminder'
  | 'fp1'
  | 'fp2'
  | 'fp3'
  | 'qualifying'
  | 'sprint'
  | 'sprint_qualifying'
  | 'race';

'use client';

import { useEffect, useState } from 'react';
import { F1Race, F1DriverStanding, F1ConstructorStanding, F1RaceResult, F1QualifyingResult, F1PracticeResult } from '@/types/f1';
import { formatSessionTime, formatSessionDate, getFlagForCountry } from '@/lib/f1-api';

type Tab = 'next' | 'calendar' | 'standings';
type StandingsTab = 'drivers' | 'constructors';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('next');
  const [standingsTab, setStandingsTab] = useState<StandingsTab>('drivers');
  const [schedule, setSchedule] = useState<F1Race[]>([]);
  const [drivers, setDrivers] = useState<F1DriverStanding[]>([]);
  const [constructors, setConstructors] = useState<F1ConstructorStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<'idle' | 'subscribed' | 'denied' | 'unsupported'>('idle');
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    checkPushStatus();
  }, []);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [scheduleRes, standingsRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch('/api/standings'),
      ]);
      const { schedule } = await scheduleRes.json();
      const { drivers, constructors } = await standingsRes.json();
      setSchedule(schedule ?? []);
      setDrivers(drivers ?? []);
      setConstructors(constructors ?? []);
      const now = new Date();
      const getRaceSessionTime = (r: F1Race) => {
        const rs = r.sessions.find(s => s.type === 'race');
        return rs ? new Date(rs.time) : new Date(r.raceDate + 'T15:00:00Z');
      };
      const next = (schedule ?? []).find((r: F1Race) => getRaceSessionTime(r) >= now);
      if (next) setExpandedRound(next.round);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function checkPushStatus() {
    if (!('Notification' in window) || !('PushManager' in window)) { setPushStatus('unsupported'); return; }
    if (Notification.permission === 'granted') setPushStatus('subscribed');
    else if (Notification.permission === 'denied') setPushStatus('denied');
  }

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setPushStatus('denied'); return; }
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) { alert('VAPID key ikke konfigureret endnu.'); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });
      const subJson = sub.toJSON();
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }),
      });
      setPushStatus('subscribed');
    } catch (err) {
      console.error('Push subscription failed:', err);
    }
  }

  async function unsubscribeFromPush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushStatus('idle');
    } catch (err) {
      console.error('Unsubscribe failed:', err);
    }
  }

  const now = new Date();

  // Use the actual race session time (not just the date) so a race isn't
  // considered "past" until after its real start time, not midnight UTC.
  const getRaceTime = (race: F1Race) => {
    const raceSession = race.sessions.find(s => s.type === 'race');
    return raceSession ? new Date(raceSession.time) : new Date(race.raceDate + 'T15:00:00Z');
  };

  const upcomingRaces = schedule.filter(r => getRaceTime(r) >= now);
  const nextRace = upcomingRaces[0] ?? null;
  const pastRaces = schedule.filter(r => getRaceTime(r) < now);
  const lastRace = pastRaces.length > 0 ? pastRaces[pastRaces.length - 1] : null;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--f1-black)', color: 'var(--f1-text)' }}>

      {/* Header */}
      <header style={{ background: 'var(--f1-dark)', borderBottom: '1px solid var(--f1-border)' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'var(--f1-red)',
              color: 'white',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.03em',
              padding: '4px 9px',
              borderRadius: '6px',
            }}>F1</span>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '15px',
              letterSpacing: '0.04em',
            }}>Reminder</span>
          </div>

          {pushStatus === 'idle' && (
            <button onClick={subscribeToPush} style={{
              background: 'var(--f1-red)',
              color: 'white',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              cursor: 'pointer',
            }}>
              Notifikationer
            </button>
          )}
          {pushStatus === 'subscribed' && (
            <button onClick={unsubscribeFromPush} style={{
              background: 'transparent',
              color: 'var(--f1-muted-light)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              fontSize: '13px',
              padding: '7px 14px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--f1-border-light)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
              Aktiv
            </button>
          )}
          {pushStatus === 'denied' && (
            <span style={{ color: 'var(--f1-muted)', fontSize: '12px' }}>Blokeret</span>
          )}
        </div>
      </header>

      {/* Nav tabs */}
      <nav style={{ background: 'var(--f1-dark)', borderBottom: '1px solid var(--f1-border)' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 16px', display: 'flex', gap: '4px' }}>
          {(['next', 'calendar', 'standings'] as Tab[]).map(tab => {
            const labels: Record<Tab, string> = { next: 'Næste', calendar: 'Kalender', standings: 'Klassement' };
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '13px',
                padding: '12px 14px',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--f1-red)' : '2px solid transparent',
                color: active ? 'var(--f1-text)' : 'var(--f1-muted)',
                cursor: 'pointer',
                transition: 'color 0.15s',
              }}>
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </nav>

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '20px 16px' }}>
        {loading ? <LoadingSkeleton /> : (
          <>
            {activeTab === 'next' && <NextRaceTab race={nextRace} totalRounds={schedule.length} lastRace={lastRace} />}
            {activeTab === 'calendar' && (
              <CalendarTab upcoming={upcomingRaces} past={pastRaces} expanded={expandedRound} onToggle={setExpandedRound} />
            )}
            {activeTab === 'standings' && (
              <StandingsTab drivers={drivers} constructors={constructors} activeTab={standingsTab} onTabChange={setStandingsTab} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Next Race Tab ────────────────────────────────────────────────────────────

type SessionResults = F1RaceResult[] | F1QualifyingResult[] | F1PracticeResult[] | 'unavailable' | null;

function NextRaceTab({ race, totalRounds, lastRace }: { race: F1Race | null; totalRounds: number; lastRace: F1Race | null }) {
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, SessionResults>>({});
  const [loadingSession, setLoadingSession] = useState<string | null>(null);
  const [lastRaceResults, setLastRaceResults] = useState<F1RaceResult[] | null>(null);
  const [lastRaceLoading, setLastRaceLoading] = useState(true);

  const now = new Date();
  // Hide once the new race weekend's first session begins
  const weekendStarted = race ? new Date(race.sessions[0]?.time) < now : false;
  const showLastRace = !weekendStarted && !!lastRace;

  useEffect(() => {
    if (!showLastRace || !lastRace) return;
    setLastRaceLoading(true);
    fetch(`/api/results?round=${lastRace.round}&type=race`)
      .then(r => r.json())
      .then(d => setLastRaceResults(d.results ?? null))
      .catch(() => setLastRaceResults(null))
      .finally(() => setLastRaceLoading(false));
  }, [showLastRace, lastRace?.round]);

  if (!race) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--f1-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🏁</div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px' }}>Ingen kommende løb</p>
      </div>
    );
  }

  const flag = getFlagForCountry(race.country);
  const raceSessionObj = race.sessions.find(s => s.type === 'race');
  const raceTime = raceSessionObj ? new Date(raceSessionObj.time) : new Date(race.raceDate + 'T15:00:00Z');
  const daysUntil = Math.ceil((raceTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  async function toggleSession(type: string, isPast: boolean) {
    if (!isPast || !race) return;
    if (openSession === type) { setOpenSession(null); return; }
    setOpenSession(type);
    if (cache[type] !== undefined) return;

    const isPractice = type === 'fp1' || type === 'fp2' || type === 'fp3';
    const apiType =
      type === 'qualifying' || type === 'sprint_qualifying' ? 'qualifying' :
      type === 'sprint' ? 'sprint' :
      type === 'race' ? 'race' : null;

    setLoadingSession(type);
    try {
      let url = '';
      if (isPractice) {
        url = `/api/practice-results?round=${race.round}&session=${type}`;
      } else if (apiType) {
        url = `/api/results?round=${race.round}&type=${apiType}`;
      } else {
        setCache(c => ({ ...c, [type]: 'unavailable' }));
        setLoadingSession(null);
        return;
      }
      const res = await fetch(url);
      const data = await res.json();
      setCache(c => ({ ...c, [type]: data.results ?? 'unavailable' }));
    } catch {
      setCache(c => ({ ...c, [type]: 'unavailable' }));
    } finally {
      setLoadingSession(null);
    }
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Seneste løb ─────────────────────────────────────────── */}
      {showLastRace && lastRace && (
        <div style={{
          background: 'var(--f1-card)',
          border: '1px solid var(--f1-border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}>
          <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--f1-muted), transparent)' }} />
          <div style={{ padding: '14px 22px 10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--f1-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>
              Seneste løb · Runde {lastRace.round}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem' }}>
              {getFlagForCountry(lastRace.country)} {lastRace.country} Grand Prix
            </div>
          </div>

          {lastRaceLoading && (
            <div style={{ padding: '12px 22px', fontSize: '12px', color: 'var(--f1-muted)' }}>
              Henter resultater…
            </div>
          )}
          {!lastRaceLoading && !lastRaceResults && (
            <div style={{ padding: '12px 22px 16px', fontSize: '12px', color: 'var(--f1-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🏎️</span> Løbet er i gang — resultater kommer snart
            </div>
          )}
          {!lastRaceLoading && lastRaceResults && (
            <SessionResultsList type="race" results={lastRaceResults} />
          )}
        </div>
      )}

      <div style={{
        background: 'linear-gradient(145deg, #1e1e1e 0%, #161616 100%)',
        border: '1px solid var(--f1-border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--f1-red), transparent)' }} />

        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--f1-red)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Runde {race.round} af {totalRounds} · 2026
              </div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2rem', lineHeight: 1.1, margin: 0 }}>
                {flag} {race.country}
              </h1>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1rem', color: 'var(--f1-muted-light)', marginTop: '3px' }}>
                Grand Prix
              </div>
            </div>
            <div style={{
              background: 'rgba(232,0,45,0.1)', border: '1px solid rgba(232,0,45,0.25)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px', textAlign: 'center', minWidth: '72px',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2.2rem', lineHeight: 1, color: 'var(--f1-red)' }}>
                {daysUntil}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--f1-red)', fontWeight: 500, opacity: 0.8, marginTop: '3px', whiteSpace: 'nowrap' }}>
                {daysUntil === 1 ? 'dag til race' : 'dage til race'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--f1-muted)', marginBottom: '18px' }}>
            {race.circuitName} · {race.locality}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--f1-border)' }}>
          <div style={{ padding: '8px 22px', borderBottom: '1px solid var(--f1-border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px' }}>📺</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--f1-muted)', letterSpacing: '0.04em' }}>TV-tider · dansk tid</span>
          </div>

          {race.sessions.map((session) => {
            const sessionTime = new Date(session.time);
            const isPast = sessionTime < now;
            const isNext = !isPast && race.sessions.filter(s => new Date(s.time) < now).length === race.sessions.indexOf(session);
            const isOpen = openSession === session.type;
            const results = cache[session.type];
            const isLoading = loadingSession === session.type;

            return (
              <div key={session.type}>
                {/* Session row */}
                <div
                  onClick={() => toggleSession(session.type, isPast)}
                  className={isNext ? 'session-next' : ''}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 22px',
                    background: isOpen ? 'rgba(255,255,255,0.03)' : isNext ? 'rgba(232,0,45,0.06)' : 'transparent',
                    borderLeft: isNext ? '3px solid var(--f1-red)' : '3px solid transparent',
                    borderBottom: '1px solid var(--f1-border)',
                    opacity: isPast && !isOpen ? 0.45 : 1,
                    cursor: isPast ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '11px',
                      padding: '3px 9px', borderRadius: 'var(--radius-pill)',
                      background: isNext ? 'var(--f1-red)' : isOpen ? 'var(--f1-border-light)' : 'var(--f1-border-light)',
                      color: isNext ? 'white' : 'var(--f1-muted-light)',
                    }}>
                      {sessionCode(session.type)}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{session.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--f1-muted)', marginTop: '1px', textTransform: 'capitalize' }}>
                        {formatSessionDate(session.time)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '15px' }}>
                        {formatSessionTime(session.time)}
                      </div>
                      {isPast && !isOpen && <div style={{ fontSize: '10px', color: 'var(--f1-muted)', marginTop: '1px' }}>Afsluttet</div>}
                      {isNext && <div style={{ fontSize: '10px', color: 'var(--f1-red)', fontWeight: 600, marginTop: '1px' }}>Næste</div>}
                    </div>
                    {isPast && (
                      <span style={{
                        color: 'var(--f1-muted)', fontSize: '13px', lineHeight: 1,
                        transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
                      }}>▾</span>
                    )}
                  </div>
                </div>

                {/* Inline results */}
                {isOpen && (
                  <div style={{ borderBottom: '1px solid var(--f1-border)', background: '#111' }}>
                    {isLoading && (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--f1-muted)', fontSize: '13px' }}>
                        Henter resultater…
                      </div>
                    )}
                    {!isLoading && results === 'unavailable' && (
                      <div style={{ padding: '16px 22px', fontSize: '12px', color: 'var(--f1-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>ℹ️</span> Resultater er ikke tilgængelige endnu
                      </div>
                    )}
                    {!isLoading && Array.isArray(results) && results.length === 0 && (
                      <div style={{ padding: '16px 22px', fontSize: '12px', color: 'var(--f1-muted)' }}>
                        Ingen resultater endnu
                      </div>
                    )}
                    {!isLoading && Array.isArray(results) && results.length > 0 && (
                      <SessionResultsList type={session.type} results={results} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {race.isSprint && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          background: 'rgba(232,0,45,0.1)', border: '1px solid rgba(232,0,45,0.2)',
          padding: '7px 14px', borderRadius: 'var(--radius-pill)',
          fontSize: '12px', fontWeight: 600, color: 'var(--f1-red)',
        }}>
          ⚡ Sprint-weekend
        </div>
      )}
    </div>
  );
}

function SessionResultsList({ type, results }: { type: string; results: SessionResults }) {
  if (!Array.isArray(results)) return null;

  const isPractice = type === 'fp1' || type === 'fp2' || type === 'fp3';
  const isQual = type === 'qualifying' || type === 'sprint_qualifying';

  const posColor = (i: number) =>
    i === 0 ? 'var(--f1-gold)' : i === 1 ? 'var(--f1-silver)' : i === 2 ? 'var(--f1-bronze)' : 'transparent';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {(results as (F1RaceResult | F1QualifyingResult | F1PracticeResult)[]).slice(0, 20).map((r, i) => {
        const pc = posColor(i);

        if (isPractice) {
          const pr = r as F1PracticeResult;
          const [lastName, ...rest] = pr.fullName.split(' ').reverse();
          const initials = rest.reverse().map(n => n[0] + '.').join(' ');
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 22px',
              borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              borderLeft: `3px solid ${pc === 'transparent' ? 'transparent' : pc}`,
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: pc !== 'transparent' ? pc : 'var(--f1-muted)', minWidth: '22px' }}>
                {pr.position}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{initials} {lastName}</div>
                <div style={{ marginTop: '2px' }}><TeamBadge name={pr.team} /></div>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '12px' }}>
                {pr.lapTime}
              </div>
            </div>
          );
        }

        if (isQual) {
          const qr = r as F1QualifyingResult;
          const bestTime = qr.q3 ?? qr.q2 ?? qr.q1;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 22px',
              borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              borderLeft: `3px solid ${pc !== 'transparent' ? pc : 'transparent'}`,
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: pc !== 'transparent' ? pc : 'var(--f1-muted)', minWidth: '22px' }}>
                {qr.position}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  {qr.driver?.givenName?.charAt(0)}. {qr.driver?.familyName}
                </div>
                <div style={{ marginTop: '2px' }}><TeamBadge name={qr.constructor?.name ?? ''} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '12px' }}>{bestTime ?? '—'}</div>
                <div style={{ fontSize: '10px', color: 'var(--f1-muted)', marginTop: '1px' }}>
                  {qr.q3 ? 'Q3' : qr.q2 ? 'Q2' : 'Q1'}
                </div>
              </div>
            </div>
          );
        }

        // Race / Sprint
        const rr = r as F1RaceResult;
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '9px 22px',
            borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            borderLeft: `3px solid ${pc !== 'transparent' ? pc : 'transparent'}`,
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', color: pc !== 'transparent' ? pc : 'var(--f1-muted)', minWidth: '22px' }}>
              {rr.positionText}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>
                {rr.driver?.givenName?.charAt(0)}. {rr.driver?.familyName}
              </div>
              <div style={{ marginTop: '2px' }}><TeamBadge name={rr.constructor?.name ?? ''} /></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '12px' }}>
                {i === 0 ? rr.time : rr.time ?? rr.status}
              </div>
              {rr.points !== '0' && (
                <div style={{ fontSize: '10px', color: 'var(--f1-muted)', marginTop: '1px' }}>{rr.points} pts</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

function CalendarTab({ upcoming, past, expanded, onToggle }: {
  upcoming: F1Race[];
  past: F1Race[];
  expanded: number | null;
  onToggle: (r: number | null) => void;
}) {
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {upcoming.map(race => (
        <RaceRow key={race.round} race={race}
          expanded={expanded === race.round}
          onToggle={() => onToggle(expanded === race.round ? null : race.round)}
          isPast={false} />
      ))}
      {past.length > 0 && (
        <>
          <div style={{ padding: '16px 4px 6px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--f1-muted)', textTransform: 'uppercase' }}>
            Afviklede løb
          </div>
          {[...past].reverse().map(race => (
            <RaceRow key={race.round} race={race}
              expanded={expanded === race.round}
              onToggle={() => onToggle(expanded === race.round ? null : race.round)}
              isPast={true} />
          ))}
        </>
      )}
    </div>
  );
}

function RaceRow({ race, expanded, onToggle, isPast }: {
  race: F1Race; expanded: boolean; onToggle: () => void; isPast: boolean;
}) {
  const flag = getFlagForCountry(race.country);
  const raceDate = new Date(race.raceDate);

  return (
    <div style={{
      background: 'var(--f1-card)', border: '1px solid var(--f1-border)',
      borderRadius: 'var(--radius)', overflow: 'hidden', opacity: isPast ? 0.5 : 1,
    }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
        padding: '14px 18px', background: 'none', border: 'none',
        cursor: 'pointer', color: 'var(--f1-text)', textAlign: 'left',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '12px',
          color: 'var(--f1-muted)', minWidth: '22px',
        }}>
          {String(race.round).padStart(2, '0')}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>{flag} {race.country}</div>
          <div style={{ fontSize: '12px', color: 'var(--f1-muted)', marginTop: '2px' }}>
            {raceDate.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}
          </div>
        </div>
        {race.isSprint && (
          <span style={{
            background: 'rgba(232,0,45,0.12)', color: 'var(--f1-red)',
            fontSize: '10px', fontWeight: 600, padding: '3px 9px',
            borderRadius: 'var(--radius-pill)', letterSpacing: '0.04em',
          }}>Sprint</span>
        )}
        <span style={{
          color: 'var(--f1-muted)', fontSize: '12px',
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}>▾</span>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--f1-border)', padding: '10px 18px 14px 54px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {race.sessions.map(session => (
            <div key={session.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{
                  fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '10px',
                  padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                  background: 'var(--f1-border)', color: 'var(--f1-muted-light)',
                }}>{sessionCode(session.type)}</span>
                <span style={{ fontSize: '12px', color: 'var(--f1-muted-light)' }}>{session.label}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
                {formatSessionTime(session.time)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Standings Tab ────────────────────────────────────────────────────────────

function StandingsTab({ drivers, constructors, activeTab, onTabChange }: {
  drivers: F1DriverStanding[];
  constructors: F1ConstructorStanding[];
  activeTab: StandingsTab;
  onTabChange: (t: StandingsTab) => void;
}) {
  const posColor = (i: number) =>
    i === 0 ? 'var(--f1-gold)' : i === 1 ? 'var(--f1-silver)' : i === 2 ? 'var(--f1-bronze)' : null;

  return (
    <div className="animate-fade-in">
      {/* Sub-tab pills */}
      <div style={{ display: 'flex', background: 'var(--f1-card)', borderRadius: 'var(--radius)', padding: '4px', gap: '4px', marginBottom: '16px', border: '1px solid var(--f1-border)' }}>
        {(['drivers', 'constructors'] as StandingsTab[]).map(t => (
          <button key={t} onClick={() => onTabChange(t)} style={{
            flex: 1, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px',
            padding: '9px 0', textAlign: 'center',
            background: activeTab === t ? 'var(--f1-card-raised)' : 'transparent',
            color: activeTab === t ? 'var(--f1-text)' : 'var(--f1-muted)',
            border: activeTab === t ? '1px solid var(--f1-border-light)' : '1px solid transparent',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {t === 'drivers' ? 'Kørere' : 'Konstruktører'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {activeTab === 'drivers' ? drivers.map((s, i) => {
          const pc = posColor(i);
          const teamColor = getTeamColor(s.constructor?.name ?? '');
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 16px 10px 0',
              background: 'var(--f1-card)',
              border: '1px solid var(--f1-border)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${pc ?? teamColor}`,
              overflow: 'hidden',
            }}>
              {/* Position */}
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px',
                color: pc ?? 'var(--f1-muted)', minWidth: '38px', textAlign: 'center', flexShrink: 0,
              }}>{s.position}</span>

              {/* Driver photo */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                overflow: 'hidden',
                background: `${teamColor}22`,
                border: `2px solid ${teamColor}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.imageUrl}
                    alt={s.driver.familyName}
                    width={44} height={44}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
                  />
                ) : (
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '11px', color: teamColor }}>
                    {s.driver.code}
                  </span>
                )}
              </div>

              {/* Name + team */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.driver.givenName.split(' ').pop()} <span style={{ fontWeight: 700 }}>{s.driver.familyName}</span>
                </div>
                <div style={{ marginTop: '3px' }}><TeamBadge name={s.constructor?.name ?? ''} /></div>
              </div>

              {/* Points */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px', lineHeight: 1, color: pc ?? 'var(--f1-text)' }}>
                  {s.points}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--f1-muted)', marginTop: '2px', letterSpacing: '0.06em' }}>pts</div>
              </div>
            </div>
          );
        }) : constructors.map((s, i) => {
          const pc = posColor(i);
          const teamColor = getTeamColor(s.constructor?.name ?? '');
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '13px 16px 13px 0',
              background: 'var(--f1-card)',
              border: '1px solid var(--f1-border)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${pc ?? teamColor}`,
            }}>
              {/* Position */}
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px',
                color: pc ?? 'var(--f1-muted)', minWidth: '38px', textAlign: 'center', flexShrink: 0,
              }}>{s.position}</span>

              {/* Team color circle */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                background: `${teamColor}22`,
                border: `2px solid ${teamColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: teamColor }} />
              </div>

              {/* Team name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{s.constructor.name}</div>
              </div>

              {/* Points */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px', lineHeight: 1, color: pc ?? 'var(--f1-text)' }}>
                  {s.points}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--f1-muted)', marginTop: '2px', letterSpacing: '0.06em' }}>pts</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps team name or constructorId → official livery colour */
function getTeamColor(name: string): string {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n.includes('ferrari'))                               return '#E8002D';
  if (n.includes('redbull') || n.includes('red_bull'))     return '#3671C6';
  if (n.includes('mercedes'))                              return '#27F4D2';
  if (n.includes('mclaren'))                               return '#FF8000';
  if (n.includes('astonmartin') || n.includes('aston'))    return '#358C75';
  if (n.includes('alpine'))                                return '#FF87BC';
  if (n.includes('williams'))                              return '#64C4FF';
  if (n.includes('haas'))                                  return '#B6BABD';
  if (n.includes('sauber') || n.includes('audi') || n.includes('kick')) return '#52E252';
  if (n.includes('racingbulls') || n.includes('alphatauri') || n === 'rb') return '#6692FF';
  return '#555';
}

function TeamBadge({ name }: { name: string }) {
  const color = getTeamColor(name);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span style={{
        width: '3px', height: '12px',
        borderRadius: '2px',
        background: color,
        flexShrink: 0,
        display: 'inline-block',
      }} />
      <span style={{ fontSize: '11px', color: 'var(--f1-muted)' }}>{name}</span>
    </div>
  );
}

function sessionCode(type: string): string {
  const codes: Record<string, string> = {
    fp1: 'FP1', fp2: 'FP2', fp3: 'FP3',
    qualifying: 'KVL', sprint_qualifying: 'SKV', sprint: 'SPR', race: 'RCE',
  };
  return codes[type] ?? type.toUpperCase().slice(0, 3);
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {[160, 72, 72].map((h, i) => (
        <div key={i} style={{
          height: `${h}px`, background: 'var(--f1-card)',
          borderRadius: 'var(--radius)', border: '1px solid var(--f1-border)',
          opacity: 1 - i * 0.2,
        }} />
      ))}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

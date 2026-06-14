'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { F1Race, F1DriverStanding, F1ConstructorStanding, F1RaceResult, F1QualifyingResult, F1PracticeResult, F1NewsItem } from '@/types/f1';
import { formatSessionTime, formatSessionDate } from '@/lib/f1-api';

type Tab = 'next' | 'calendar' | 'standings' | 'news';
type StandingsTab = 'drivers' | 'constructors';

const CACHE_KEY = 'f1_app_v2';
const NEWS_CACHE_KEY = 'f1_news_v1';

function getRaceTime(race: F1Race) {
  const raceSession = race.sessions.find(s => s.type === 'race');
  return raceSession ? new Date(raceSession.time) : new Date(race.raceDate + 'T15:00:00Z');
}

const TABS: { tab: Tab; label: string; Icon: React.FC<{ active: boolean }> }[] = [
  {
    tab: 'next',
    label: 'Næste',
    Icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#ffffff' : 'rgba(255,255,255,0.6)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    tab: 'calendar',
    label: 'Kalender',
    Icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#ffffff' : 'rgba(255,255,255,0.6)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    tab: 'standings',
    label: 'Klassement',
    Icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#ffffff' : 'rgba(255,255,255,0.6)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6"  y1="20" x2="6"  y2="14" />
      </svg>
    ),
  },
  {
    tab: 'news',
    label: 'Nyheder',
    Icon: ({ active }) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#ffffff' : 'rgba(255,255,255,0.6)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" />
      </svg>
    ),
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('next');
  const [standingsTab, setStandingsTab] = useState<StandingsTab>('drivers');
  const [schedule, setSchedule] = useState<F1Race[]>([]);
  const [drivers, setDrivers] = useState<F1DriverStanding[]>([]);
  const [constructors, setConstructors] = useState<F1ConstructorStanding[]>([]);
  const [news, setNews] = useState<F1NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<'idle' | 'subscribed' | 'denied' | 'unsupported' | 'pwa-only'>('idle');
  const [expandedRound, setExpandedRound] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [staleData, setStaleData] = useState(false);

  // ── Pull-to-refresh ──────────────────────────────────────────────────────────
  const [ptrRefreshing, setPtrRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const pullYRef = useRef(0);
  const pullActive = useRef(false);
  const fetchDataRef = useRef<() => Promise<void>>(async () => {});

  const PTR_THRESHOLD = 65;
  const PTR_MAX = 82;

  useEffect(() => {
    fetchDataRef.current = fetchData;
  });

  // Set indicator hidden before first paint so there's no flash
  useLayoutEffect(() => {
    const ind = indicatorRef.current;
    if (!ind) return;
    ind.style.transform = 'translateX(-50%) translateY(-48px)';
    ind.style.opacity = '0';
    ind.style.transition = 'none';
    ind.style.color = 'var(--f1-muted)';
  }, []);

  // Animate indicator away when refresh completes
  useEffect(() => {
    if (ptrRefreshing) return;
    const ind = indicatorRef.current;
    if (!ind) return;
    ind.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s';
    ind.style.transform = 'translateX(-50%) translateY(-48px)';
    ind.style.opacity = '0';
  }, [ptrRefreshing]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      touchStartY.current = e.touches[0].clientY;
      pullActive.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!pullActive.current) return;
      if (window.scrollY > 0) { pullActive.current = false; return; }
      const delta = e.touches[0].clientY - touchStartY.current;
      const ind = indicatorRef.current;
      if (delta <= 0) {
        pullYRef.current = 0;
        if (ind) { ind.style.transition = 'none'; ind.style.transform = 'translateX(-50%) translateY(-48px)'; ind.style.opacity = '0'; }
        return;
      }
      e.preventDefault();
      const y = Math.min(delta / 2.2, PTR_MAX);
      pullYRef.current = y;
      if (ind) {
        const over = y >= PTR_THRESHOLD;
        ind.style.transition = 'none';
        ind.style.transform = `translateX(-50%) translateY(${Math.max(-48, y - 48)}px)`;
        ind.style.opacity = y > 4 ? '1' : '0';
        ind.style.color = over ? 'var(--f1-text)' : 'var(--f1-muted)';
        const arrow = ind.querySelector('.ptr-arrow') as HTMLElement | null;
        if (arrow) arrow.style.transform = `rotate(${Math.min((y / PTR_THRESHOLD) * 180, 180)}deg)`;
        const text = ind.querySelector('.ptr-text') as HTMLElement | null;
        if (text) text.textContent = over ? 'Slip for at opdatere' : 'Træk for at opdatere';
      }
    };

    const onEnd = () => {
      if (!pullActive.current) return;
      pullActive.current = false;
      const y = pullYRef.current;
      pullYRef.current = 0;
      const ind = indicatorRef.current;
      if (y >= PTR_THRESHOLD) {
        if (ind) {
          ind.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)';
          ind.style.transform = 'translateX(-50%) translateY(12px)';
        }
        setPtrRefreshing(true);
        fetchDataRef.current().finally(() => setPtrRefreshing(false));
      } else {
        if (ind) {
          ind.style.transition = 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s';
          ind.style.transform = 'translateX(-50%) translateY(-48px)';
          ind.style.opacity = '0';
        }
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []);
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Service worker is registered automatically by @serwist/next
    checkPushStatus();
  }, []);

  useEffect(() => { fetchData(); loadNews(); }, []);

  function applyData(schedule: F1Race[], drivers: F1DriverStanding[], constructors: F1ConstructorStanding[]) {
    setNow(new Date());
    setSchedule(schedule);
    setDrivers(drivers);
    setConstructors(constructors);
    const now = new Date();
    const getRaceSessionTime = (r: F1Race) => {
      const rs = r.sessions.find(s => s.type === 'race');
      return rs ? new Date(rs.time) : new Date(r.raceDate + 'T15:00:00Z');
    };
    const next = schedule.find(r => getRaceSessionTime(r) >= now);
    if (next) setExpandedRound(next.round);
  }

  async function fetchData() {
    setLoading(true);
    setLoadError(false);
    setStaleData(false);
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 12000);
      const [scheduleRes, standingsRes] = await Promise.all([
        fetch('/api/schedule', { signal: ctrl.signal }),
        fetch('/api/standings', { signal: ctrl.signal }),
      ]);
      clearTimeout(timeout);

      if (!scheduleRes.ok || !standingsRes.ok) throw new Error('API error');

      const { schedule } = await scheduleRes.json();
      const { drivers, constructors } = await standingsRes.json();

      if (!schedule) throw new Error('No schedule data');

      applyData(schedule, drivers ?? [], constructors ?? []);

      // Save fresh data to localStorage
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ schedule, drivers: drivers ?? [], constructors: constructors ?? [], cachedAt: Date.now() }));
      } catch { /* storage full or unavailable */ }

    } catch (err) {
      console.error(err);

      // Try localStorage fallback
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.schedule?.length) {
            applyData(cached.schedule, cached.drivers ?? [], cached.constructors ?? []);
            setStaleData(true);
            return;
          }
        }
      } catch { /* no cache */ }

      setLoadError(true);
    } finally {
      setLoading(false);
    }
    // News refreshes alongside core data (e.g. on pull-to-refresh) but never
    // blocks it — a slow or failed feed must not break the schedule/standings UI.
    loadNews();
  }

  async function loadNews() {
    setNewsError(false);
    try {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch('/api/news', { signal: ctrl.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('News API error');
      const { news } = await res.json();
      if (!Array.isArray(news)) throw new Error('No news data');
      setNews(news);
      try {
        localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ news, cachedAt: Date.now() }));
      } catch { /* storage full or unavailable */ }
    } catch (err) {
      console.error(err);
      try {
        const raw = localStorage.getItem(NEWS_CACHE_KEY);
        const cached = raw ? JSON.parse(raw) : null;
        if (cached?.news?.length) { setNews(cached.news); return; }
      } catch { /* no cache */ }
      setNewsError(true);
    } finally {
      setNewsLoading(false);
    }
  }

  function checkPushStatus() {
    // iOS only supports push in standalone PWA mode (not in Safari/Chrome browser tabs)
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in navigator && (navigator as Record<string, unknown>).standalone === true);
    if (isIos && !isStandalone) { setPushStatus('pwa-only'); return; }

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

  const upcomingRaces = useMemo(() => schedule.filter(r => getRaceTime(r) >= now), [schedule, now]);
  const pastRaces = useMemo(() => schedule.filter(r => getRaceTime(r) < now), [schedule, now]);
  const nextRace = upcomingRaces[0] ?? null;
  const lastRace = pastRaces.length > 0 ? pastRaces[pastRaces.length - 1] : null;

  return (
    <div ref={containerRef} style={{ minHeight: '100dvh', background: 'radial-gradient(120% 80% at 80% 0%, #3a0c16 0%, #1a070c 45%, #0a0a0a 100%)', color: 'var(--f1-text)' }}>

      {/* Pull-to-refresh indicator — transform/opacity/transition controlled imperatively */}
      <div
        ref={indicatorRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--f1-card)',
          border: '1px solid var(--f1-border-light)',
          borderRadius: '999px',
          padding: '7px 16px 7px 12px',
          fontSize: '12px',
          fontFamily: 'var(--font-body)',
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        {ptrRefreshing
          ? <span className="ptr-spinner" />
          : <span className="ptr-arrow">↓</span>
        }
        <span className="ptr-text">
          {ptrRefreshing ? 'Opdaterer…' : 'Træk for at opdatere'}
        </span>
      </div>

      {/* Header */}
      <header style={{ background: 'transparent' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
          {pushStatus === 'pwa-only' && (
            <span style={{ color: 'var(--f1-muted)', fontSize: '12px', textAlign: 'right', lineHeight: '1.3' }}>
              Kræver PWA
            </span>
          )}
        </div>
      </header>

      {/* Floating glass tab bar */}
      <nav style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom) + 18px)',
        left: 0, right: 0, zIndex: 100,
        display: 'flex', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px',
          borderRadius: 'var(--radius-pill)',
          background: 'rgba(28,28,30,0.5)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 12px 34px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
          pointerEvents: 'auto',
        }}>
          {/* Sliding red active indicator — stride = 46px button + 6px gap */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: '8px', left: '8px',
            width: '46px', height: '46px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
            transform: `translateX(${TABS.findIndex(t => t.tab === activeTab) * 52}px)`,
            transition: 'transform 0.32s cubic-bezier(0.34,1.56,0.64,1)',
          }} />
          {TABS.map(({ tab, label, Icon }) => {
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} aria-label={label} style={{
                position: 'relative', zIndex: 1,
                width: '46px', height: '46px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer',
                borderRadius: '50%',
              }}>
                <Icon active={active} />
              </button>
            );
          })}
        </div>
      </nav>

      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '20px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 104px)' }}>
        {staleData && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)',
            borderRadius: 'var(--radius-sm)', padding: '9px 14px', marginBottom: '14px',
            fontSize: '12px', color: '#c9a800',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Viser gemt data — ingen forbindelse til serveren
            </span>
            <button onClick={() => fetchData()} style={{
              background: 'none', border: 'none', color: '#c9a800', fontSize: '12px',
              cursor: 'pointer', fontWeight: 600, padding: '0 0 0 12px',
            }}>Prøv igen</button>
          </div>
        )}
        {activeTab === 'news' ? (
          <NewsTab items={news} loading={newsLoading} error={newsError} onRetry={loadNews} />
        ) : loading ? <LoadingSkeleton /> : loadError ? (
          <div style={{ textAlign: 'center', padding: '64px 0 48px' }}>
            <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#606060" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="2.5" />
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>
              Kunne ikke hente data
            </div>
            <div style={{ fontSize: '13px', color: 'var(--f1-muted)', marginBottom: '24px' }}>
              Tjek din forbindelse og prøv igen
            </div>
            <button
              onClick={() => fetchData()}
              style={{
                background: 'var(--f1-red)', color: 'white',
                fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '14px',
                padding: '10px 24px', borderRadius: 'var(--radius-pill)',
                border: 'none', cursor: 'pointer',
              }}
            >
              Prøv igen
            </button>
          </div>
        ) : (
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

type SessionResults = F1RaceResult[] | F1QualifyingResult[] | F1PracticeResult[] | 'unavailable' | 'live_session' | null;

function NextRaceTab({ race, totalRounds, lastRace }: { race: F1Race | null; totalRounds: number; lastRace: F1Race | null }) {
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, SessionResults>>({});
  const [loadingSession, setLoadingSession] = useState<string | null>(null);
  const [lastRaceResults, setLastRaceResults] = useState<F1RaceResult[] | null>(null);
  const [lastRaceLoading, setLastRaceLoading] = useState(true);
  const [lastRaceExpanded, setLastRaceExpanded] = useState(false);

  const now = new Date();
  // Hide once the new race weekend's first session begins
  const weekendStarted = race ? new Date(race.sessions[0]?.time) < now : false;
  const showLastRace = !weekendStarted && !!lastRace;

  useEffect(() => {
    if (!showLastRace || !lastRace || !lastRaceExpanded) return;
    if (lastRaceResults !== null) return; // already loaded
    setLastRaceLoading(true);
    fetch(`/api/results?round=${lastRace.round}&type=race`)
      .then(r => r.json())
      .then(d => setLastRaceResults(d.results ?? null))
      .catch(() => setLastRaceResults(null))
      .finally(() => setLastRaceLoading(false));
  }, [showLastRace, lastRace?.round, lastRaceExpanded]);

  if (!race) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--f1-muted)' }}>
        <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      </div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '14px' }}>Ingen kommende løb</p>
      </div>
    );
  }

  const raceSessionObj = race.sessions.find(s => s.type === 'race');
  const raceTime = raceSessionObj ? new Date(raceSessionObj.time) : new Date(race.raceDate + 'T15:00:00Z');
  const daysUntil = Math.ceil((raceTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));


  async function toggleSession(type: string, isPast: boolean) {
    if (!isPast || !race) return;
    if (openSession === type) { setOpenSession(null); return; }
    setOpenSession(type);
    // Don't retry successful results, but do allow retry on unavailable/live_session
    if (cache[type] !== undefined && cache[type] !== 'unavailable' && cache[type] !== 'live_session') return;

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
      if (data.results) {
        setCache(c => ({ ...c, [type]: data.results }));
      } else if (data.reason === 'live_session' || data.reason === 'auth_required') {
        setCache(c => ({ ...c, [type]: 'live_session' }));
      } else {
        setCache(c => ({ ...c, [type]: 'unavailable' }));
      }
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
          <button
            onClick={() => setLastRaceExpanded(e => !e)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 22px', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left', color: 'var(--f1-text)',
            }}
          >
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--f1-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '5px' }}>
                Seneste løb · Runde {lastRace.round}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CountryFlag country={lastRace.country} size={22} />
                {lastRace.country} Grand Prix
              </div>
            </div>
            <span style={{
              color: 'var(--f1-muted)', fontSize: '13px', flexShrink: 0, marginLeft: '12px',
              transform: lastRaceExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
            }}>▾</span>
          </button>

          {lastRaceExpanded && (
            <>
              {lastRaceLoading && (
                <div style={{ padding: '12px 22px', fontSize: '12px', color: 'var(--f1-muted)' }}>
                  Henter resultater…
                </div>
              )}
              {!lastRaceLoading && !lastRaceResults && (() => {
                const lastRaceSession = lastRace.sessions.find(s => s.type === 'race');
                const lastRaceTime = lastRaceSession ? new Date(lastRaceSession.time) : new Date(lastRace.raceDate + 'T15:00:00Z');
                const hoursAgo = (now.getTime() - lastRaceTime.getTime()) / (1000 * 60 * 60);
                const msg = hoursAgo < 4
                  ? 'Løbet er sandsynligvis i gang — resultater snart'
                  : 'Resultater ikke tilgængelige endnu — prøv igen senere';
                return (
                  <div style={{ padding: '12px 22px 16px', fontSize: '12px', color: 'var(--f1-muted)' }}>
                    {msg}
                  </div>
                );
              })()}
              {!lastRaceLoading && lastRaceResults && (
                <SessionResultsList type="race" results={lastRaceResults} />
              )}
            </>
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
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2rem', lineHeight: 1.1, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CountryFlag country={race.country} size={32} />
                {race.country}
              </h1>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '1rem', color: 'var(--f1-muted-light)', marginTop: '3px' }}>
                Grand Prix
              </div>
            </div>
            <div style={{
              background: 'var(--f1-red)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px', textAlign: 'center', minWidth: '72px',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '2.2rem', lineHeight: 1, color: '#fff' }}>
                {daysUntil}
              </div>
              <div style={{ fontSize: '11px', color: '#fff', fontWeight: 700, marginTop: '3px', whiteSpace: 'nowrap' }}>
                {daysUntil === 1 ? 'dag til race' : 'dage til race'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--f1-muted)', marginBottom: '18px' }}>
            {race.circuitName} · {race.locality}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--f1-border)' }}>
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
                    {!isLoading && results === 'live_session' && (
                      <div style={{ padding: '16px 22px', fontSize: '12px', color: 'var(--f1-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Utilgængeligt under aktiv F1-session — prøv igen efter løbet
                      </div>
                    )}
                    {!isLoading && results === 'unavailable' && (
                      <div style={{ padding: '16px 22px', fontSize: '12px', color: 'var(--f1-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {session.type === 'race' || session.type === 'sprint' ? 'Løbsresultater ikke tilgængelige' : session.type === 'qualifying' || session.type === 'sprint_qualifying' ? 'Kvalifikationsresultater ikke tilgængelige' : 'Træningsresultater ikke tilgængelige'}
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
          Sprint-weekend
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
  const [view, setView] = useState<'upcoming' | 'past'>(upcoming.length > 0 ? 'upcoming' : 'past');
  const races = useMemo(
    () => view === 'upcoming' ? upcoming : [...past].reverse(),
    [view, upcoming, past],
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Segmented control */}
      <div style={{
        display: 'flex',
        background: 'var(--f1-card)',
        border: '1px solid var(--f1-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '3px',
        gap: '2px',
      }}>
        {([
          { key: 'upcoming', label: `Kommende · ${upcoming.length}` },
          { key: 'past',     label: `Afviklede · ${past.length}` },
        ] as { key: 'upcoming' | 'past'; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              flex: 1,
              padding: '9px 0',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '13px',
              letterSpacing: '0.02em',
              transition: 'background 0.15s, color 0.15s',
              background: view === key ? 'var(--f1-red)' : 'transparent',
              color: view === key ? '#ffffff' : 'var(--f1-muted)',
              boxShadow: 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Race list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {races.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--f1-muted)', fontSize: '13px' }}>
            Ingen løb at vise
          </div>
        ) : races.map(race => (
          <RaceRow key={race.round} race={race}
            expanded={expanded === race.round}
            onToggle={() => onToggle(expanded === race.round ? null : race.round)}
            isPast={view === 'past'} />
        ))}
      </div>

    </div>
  );
}

function RaceRow({ race, expanded, onToggle, isPast }: {
  race: F1Race; expanded: boolean; onToggle: () => void; isPast: boolean;
}) {
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, SessionResults>>({});
  const [loadingSession, setLoadingSession] = useState<string | null>(null);

  const raceDate = new Date(race.raceDate);
  const now = new Date();

  async function toggleSession(type: string, sessionTime: string) {
    if (new Date(sessionTime) >= now) return;
    if (openSession === type) { setOpenSession(null); return; }
    setOpenSession(type);
    // Don't retry successful results, but do allow retry on unavailable/live_session
    if (cache[type] !== undefined && cache[type] !== 'unavailable' && cache[type] !== 'live_session') return;

    const isPractice = type === 'fp1' || type === 'fp2' || type === 'fp3';
    const apiType =
      type === 'qualifying' || type === 'sprint_qualifying' ? 'qualifying' :
      type === 'sprint' ? 'sprint' :
      type === 'race' ? 'race' : null;

    setLoadingSession(type);
    try {
      const url = isPractice
        ? `/api/practice-results?round=${race.round}&session=${type}`
        : apiType
          ? `/api/results?round=${race.round}&type=${apiType}`
          : null;
      if (!url) { setCache(c => ({ ...c, [type]: 'unavailable' })); return; }
      const res = await fetch(url);
      const data = await res.json();
      if (data.results) {
        setCache(c => ({ ...c, [type]: data.results }));
      } else if (data.reason === 'live_session' || data.reason === 'auth_required') {
        setCache(c => ({ ...c, [type]: 'live_session' }));
      } else {
        setCache(c => ({ ...c, [type]: 'unavailable' }));
      }
    } catch {
      setCache(c => ({ ...c, [type]: 'unavailable' }));
    } finally {
      setLoadingSession(null);
    }
  }

  return (
    <div style={{
      background: 'var(--f1-card)', border: '1px solid var(--f1-border)',
      borderRadius: 'var(--radius)', overflow: 'hidden',
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
          <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--f1-text)', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <CountryFlag country={race.country} size={18} />
            {race.country}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--f1-muted)', marginTop: '1px' }}>{race.circuitName}</div>
          <div style={{ fontSize: '11px', color: 'var(--f1-muted)', marginTop: '1px' }}>
            {raceDate.toLocaleDateString('da-DK', { day: 'numeric', month: 'long' })}
          </div>
        </div>
        {isPast ? (
          <span style={{
            background: 'rgba(74,222,128,0.12)', color: '#4ade80',
            fontSize: '10px', fontWeight: 600, padding: '3px 8px',
            borderRadius: 'var(--radius-pill)', letterSpacing: '0.04em', flexShrink: 0,
          }}>✓</span>
        ) : race.isSprint && (
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
        <div style={{ borderTop: '1px solid var(--f1-border)' }}>
          {(isPast
            ? race.sessions.filter(s => s.type === 'qualifying' || s.type === 'race')
            : race.sessions
          ).map(session => {
            const sessionPast = new Date(session.time) < now;
            const isOpen = openSession === session.type;
            const results = cache[session.type];
            const isLoading = loadingSession === session.type;
            return (
              <div key={session.type}>
                <div
                  onClick={() => toggleSession(session.type, session.time)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 18px 9px 54px',
                    background: isOpen ? 'rgba(255,255,255,0.03)' : 'transparent',
                    borderBottom: '1px solid var(--f1-border)',
                    cursor: sessionPast ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '10px',
                      padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                      background: 'var(--f1-border)', color: 'var(--f1-muted-light)',
                    }}>{sessionCode(session.type)}</span>
                    <span style={{ fontSize: '12px', color: 'var(--f1-muted-light)' }}>{session.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px' }}>
                      {formatSessionTime(session.time)}
                    </span>
                    {sessionPast && (
                      <span style={{
                        color: 'var(--f1-muted)', fontSize: '12px', lineHeight: 1,
                        transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
                      }}>▾</span>
                    )}
                  </div>
                </div>
                {isOpen && (
                  <div style={{ borderBottom: '1px solid var(--f1-border)', background: '#111' }}>
                    {isLoading && (
                      <div style={{ padding: '16px 22px', fontSize: '12px', color: 'var(--f1-muted)' }}>Henter resultater…</div>
                    )}
                    {!isLoading && results === 'live_session' && (
                      <div style={{ padding: '14px 22px', fontSize: '12px', color: 'var(--f1-muted)', display: 'flex', gap: '8px' }}>
                        Utilgængeligt under aktiv F1-session — prøv igen efter løbet
                      </div>
                    )}
                    {!isLoading && results === 'unavailable' && (
                      <div style={{ padding: '14px 22px', fontSize: '12px', color: 'var(--f1-muted)', display: 'flex', gap: '8px' }}>
                        {session.type === 'race' || session.type === 'sprint' ? 'Løbsresultater ikke tilgængelige' : session.type === 'qualifying' || session.type === 'sprint_qualifying' ? 'Kvalifikationsresultater ikke tilgængelige' : 'Træningsresultater ikke tilgængelige'}
                      </div>
                    )}
                    {!isLoading && Array.isArray(results) && results.length === 0 && (
                      <div style={{ padding: '14px 22px', fontSize: '12px', color: 'var(--f1-muted)' }}>Ingen resultater endnu</div>
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
            background: activeTab === t ? 'var(--f1-red)' : 'transparent',
            color: activeTab === t ? '#ffffff' : 'var(--f1-muted)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
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
              borderLeft: pc ? `3px solid ${pc}` : '1px solid var(--f1-border)',
              overflow: 'hidden',
            }}>
              {/* Position */}
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px',
                color: pc ?? 'var(--f1-muted)', minWidth: '38px', textAlign: 'center', flexShrink: 0,
              }}>{s.position}</span>

              {/* Driver photo */}
              {(() => {
                const photo = getF1DriverPhoto(s.driver.givenName, s.driver.familyName, s.constructor?.name ?? '');
                return (
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                    overflow: 'hidden',
                    background: `${teamColor}22`,
                    border: `2px solid ${teamColor}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
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
                );
              })()}

              {/* Name + team */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.driver.givenName.split(' ').pop()} <span style={{ fontWeight: 700 }}>{s.driver.familyName}</span>
                </div>
                <div style={{ marginTop: '3px' }}><TeamBadge name={s.constructor?.name ?? ''} /></div>
              </div>

              {/* Points */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px', lineHeight: 1, color: teamColor }}>
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
              padding: '12px 16px 12px 0',
              background: 'var(--f1-card)',
              border: '1px solid var(--f1-border)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: pc ? `3px solid ${pc}` : '1px solid var(--f1-border)',
            }}>
              {/* Position */}
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px',
                color: pc ?? 'var(--f1-muted)', minWidth: '38px', textAlign: 'center', flexShrink: 0,
              }}>{s.position}</span>

              {/* Team logo — solid team colour background, white logo on top */}
              {(() => {
                const logo = getF1TeamLogo(s.constructor?.name ?? '');
                return (
                  <div style={{
                    width: '64px', height: '38px', borderRadius: '6px', flexShrink: 0,
                    background: teamColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                    padding: '6px 10px',
                  }}>
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={logo}
                        alt={s.constructor.name}
                        width={44} height={26}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '10px', color: '#fff', textAlign: 'center', lineHeight: 1.1 }}>
                        {s.constructor.name.split(' ').map((w: string) => w[0]).join('').slice(0, 3)}
                      </span>
                    )}
                  </div>
                );
              })()}

              {/* Team name + nationality */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.constructor.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--f1-muted)', marginTop: '2px' }}>
                  {translateNationality(s.constructor.nationality)}
                </div>
              </div>

              {/* Points */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '20px', lineHeight: 1, color: teamColor }}>
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

// ─── News Tab ─────────────────────────────────────────────────────────────────

function NewsTab({ items, loading, error, onRetry }: {
  items: F1NewsItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading && items.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} style={{
            height: '92px', background: 'var(--f1-card)',
            borderRadius: 'var(--radius)', border: '1px solid var(--f1-border)',
            opacity: 1 - i * 0.15,
          }} />
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0 48px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>
          Kunne ikke hente nyheder
        </div>
        <div style={{ fontSize: '13px', color: 'var(--f1-muted)', marginBottom: '24px' }}>
          Tjek din forbindelse og prøv igen
        </div>
        <button onClick={onRetry} style={{
          background: 'var(--f1-red)', color: 'white',
          fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '14px',
          padding: '10px 24px', borderRadius: 'var(--radius-pill)',
          border: 'none', cursor: 'pointer',
        }}>
          Prøv igen
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {items.map((item, i) => (
        <a
          key={item.link + i}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', gap: '12px',
            background: 'var(--f1-card)', border: '1px solid var(--f1-border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
            textDecoration: 'none', color: 'var(--f1-text)',
          }}
        >
          {item.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt=""
              width={96}
              height={96}
              loading="lazy"
              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'flex'; e.currentTarget.style.display = 'none'; }}
              style={{ width: '96px', height: '96px', objectFit: 'cover', flexShrink: 0, background: 'var(--f1-border)' }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0, padding: '12px 14px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{
              fontWeight: 600, fontSize: '14px', lineHeight: 1.3,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {item.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '11px', color: 'var(--f1-muted)' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 600,
                color: 'var(--f1-muted-light)', letterSpacing: '0.02em',
              }}>{item.source}</span>
              {item.publishedAt && (
                <>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>{timeAgo(item.publishedAt)}</span>
                </>
              )}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

/** Compact Danish relative time, e.g. "3 t siden", "2 d siden". */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'lige nu';
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} t siden`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} d siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps team name → F1 CDN slug used for logos and driver photos */
function getF1TeamSlug(name: string): string | null {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const map: [string, string][] = [
    ['ferrari',      'ferrari'],
    ['redbull',      'redbullracing'],
    ['mclaren',      'mclaren'],
    ['mercedes',     'mercedes'],
    ['astonmartin',  'astonmartin'],
    ['aston',        'astonmartin'],
    ['alpine',       'alpine'],
    ['williams',     'williams'],
    ['haas',         'haasf1team'],
    ['racingbulls',  'racingbulls'],
    ['rbf1',         'racingbulls'],   // "RB F1 Team" → rbf1team
    ['alphatauri',   'racingbulls'],
    ['sauber',       'audi'],
    ['audi',         'audi'],
    ['kick',         'audi'],
    ['cadillac',     'cadillac'],
  ];
  for (const [key, slug] of map) {
    if (n.includes(key)) return slug;
  }
  return null;
}

/** Official F1 CDN white team logo */
function getF1TeamLogo(name: string): string | null {
  const slug = getF1TeamSlug(name);
  if (!slug) return null;
  return `https://media.formula1.com/image/upload/c_lfill,w_80/q_auto/v1740000001/common/f1/2026/${slug}/2026${slug}logowhite.webp`;
}

/** Official F1 CDN driver headshot — falls back to silhouette if not found */
function getF1DriverPhoto(givenName: string, familyName: string, constructorName: string): string | null {
  const slug = getF1TeamSlug(constructorName);
  if (!slug) return null;
  // Strip accents (handles Pérez → per, Hülkenberg → hul), take first 3 chars
  const norm3 = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
  const code = norm3(givenName) + norm3(familyName) + '01';
  return `https://media.formula1.com/image/upload/c_lfill,w_140/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/v1740000001/common/f1/2026/${slug}/${code}/2026${slug}${code}right.webp`;
}

/** Maps team name or constructorId → official livery colour */
function getTeamColor(name: string): string {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n.includes('ferrari'))                                            return '#E8002D';
  if (n.includes('redbull') || n.includes('red_bull'))                  return '#3671C6';
  if (n.includes('mercedes'))                                           return '#27F4D2';
  if (n.includes('mclaren'))                                            return '#FF8000';
  if (n.includes('astonmartin') || n.includes('aston'))                 return '#358C75';
  if (n.includes('alpine'))                                             return '#FF87BC';
  if (n.includes('williams'))                                           return '#64C4FF';
  if (n.includes('haas'))                                               return '#B6BABD';
  if (n.includes('sauber') || n.includes('audi') || n.includes('kick')) return '#52E252';
  if (n.includes('racingbulls') || n.includes('rbf1') || n.includes('alphatauri') || n === 'rb') return '#6692FF';
  if (n.includes('cadillac'))                                           return '#003DA5';
  return '#555555'; // 6-char so opacity suffix (#55555522) stays valid
}

function TeamBadge({ name }: { name: string }) {
  const color = getTeamColor(name);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: color + '1e',
      borderRadius: '100px',
      padding: '3px 8px 3px 5px',
    }}>
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%',
        background: color, flexShrink: 0,
        boxShadow: `0 0 6px ${color}99`,
      }} />
      <span style={{ fontSize: '11px', color: 'var(--f1-muted-light)', fontWeight: 500, letterSpacing: '0.01em' }}>
        {name}
      </span>
    </span>
  );
}

/** ISO 3166-1 alpha-2 code for a race-hosting country name (handles both Danish and English) */
function getCountryCode(country: string): string | null {
  const n = country.toLowerCase();
  if (n.includes('australien') || n.includes('australia'))           return 'au';
  if (n.includes('bahrain'))                                          return 'bh';
  if (n.includes('saudi'))                                            return 'sa';
  if (n.includes('japan'))                                            return 'jp';
  if (n.includes('kina') || n.includes('china'))                     return 'cn';
  if (n.includes('monaco'))                                           return 'mc';
  if (n.includes('canada'))                                           return 'ca';
  if (n.includes('spanien') || n.includes('spain'))                  return 'es';
  if (n.includes('østrig') || n.includes('austria'))                 return 'at';
  if (n.includes('storbritan') || n.includes('great brit') || n === 'uk') return 'gb';
  if (n.includes('belgien') || n.includes('belgium'))                return 'be';
  if (n.includes('ungarn') || n.includes('hungary'))                 return 'hu';
  if (n.includes('holland') || n.includes('netherlands'))            return 'nl';
  if (n.includes('italien') || n.includes('italy'))                  return 'it';
  if (n.includes('aserbajdsjan') || n.includes('azerbaijan'))        return 'az';
  if (n.includes('singapore'))                                        return 'sg';
  if (n.includes('brasilien') || n.includes('brazil'))               return 'br';
  if (n.includes('mexico'))                                           return 'mx';
  if (n.includes('qatar'))                                            return 'qa';
  if (n.includes('abu dhabi') || n.includes('united arab'))          return 'ae';
  if (n.includes('usa') || n.includes('united states') || n.includes('miami') || n.includes('las vegas')) return 'us';
  return null;
}

/** Translate Jolpica English nationality strings to Danish */
function translateNationality(nat: string): string {
  const map: Record<string, string> = {
    'German': 'Tysk', 'Italian': 'Italiensk', 'British': 'Britisk',
    'Austrian': 'Østrigsk', 'French': 'Fransk', 'American': 'Amerikansk',
    'Brazilian': 'Brasiliansk', 'Dutch': 'Hollandsk', 'Spanish': 'Spansk',
    'Finnish': 'Finsk', 'Mexican': 'Mexicansk', 'Canadian': 'Canadisk',
    'Australian': 'Australsk', 'Japanese': 'Japansk', 'Chinese': 'Kinesisk',
    'Monegasque': 'Monegaskisk', 'Belgian': 'Belgisk', 'Swiss': 'Schweizisk',
  };
  return map[nat] ?? nat;
}

function CountryFlag({ country, size = 20 }: { country: string; size?: number }) {
  const code = getCountryCode(country);
  if (!code) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={country}
      width={size}
      height={Math.round(size * 0.67)}
      style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: '2px', flexShrink: 0, objectFit: 'contain' }}
    />
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

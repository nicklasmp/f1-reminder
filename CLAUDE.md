# F1 Reminder — Project Context for Claude Code

## Hvad er dette?
En PWA der sender push-notifikationer inden F1-sessioner. Bygget med Next.js 14, Supabase og cron-job.org.

## Stack
- **Framework**: Next.js 14 (App Router, TypeScript)
- **Database**: Supabase (push subscriptions)
- **Deploy**: Vercel
- **Push**: Web Push API + web-push npm pakke
- **Cron**: cron-job.org (ekstern, gratis)
- **F1 Data**: Jolpica API (api.jolpi.ca/ergast/f1) — gratis, ingen auth

## Projektstruktur
```
app/
  page.tsx              # Hoved-UI: Næste løb, Kalender, Standings
  layout.tsx            # PWA meta tags, fonts (Barlow Condensed)
  globals.css           # F1 farvevariabler + animationer
  api/
    subscribe/route.ts  # POST: gem push subscription / DELETE: fjern
    send-notifications/ # POST: trigges af cron-job.org
    schedule/route.ts   # GET: returner race kalender
    standings/route.ts  # GET: returner driver + constructor standings
lib/
  f1-api.ts             # Jolpica API helpers + formattering
  push.ts               # web-push helpers, notification builders
  supabase.ts           # Supabase client (public + admin)
types/
  f1.ts                 # TypeScript interfaces
public/
  sw.js                 # Service Worker (push events)
  manifest.json         # PWA manifest
```

## Setup-trin (første gang)

### 1. VAPID keys
```bash
npx web-push generate-vapid-keys
```
Kopiér output til `.env.local`.

### 2. .env.local
Kopiér `.env.local.example` til `.env.local` og udfyld:
- Supabase URL + keys (fra Supabase dashboard)
- VAPID keys (genereret ovenfor)
- CRON_SECRET (valgfri lang streng)

### 3. Supabase tabel
Kør `supabase-schema.sql` i Supabase SQL Editor.

### 4. Kør lokalt
```bash
npm run dev
```

### 5. Vercel deploy
```bash
vercel
```
Husk at sætte alle env vars i Vercel dashboard.

### 6. cron-job.org setup
Opret to jobs på https://cron-job.org:

**Job 1 — Onsdag reminder:**
- URL: `https://[din-app].vercel.app/api/send-notifications`
- Schedule: Onsdag kl. 08:00 (CET)
- Header: `x-cron-secret: [din CRON_SECRET]`
- Method: POST

**Job 2 — Session reminders:**
- URL: `https://[din-app].vercel.app/api/send-notifications`
- Schedule: Hver time (F1-weekender: fredag–søndag)
- Header: `x-cron-secret: [din CRON_SECRET]`
- Method: POST

## F1 Data API
- Kalender: `https://api.jolpi.ca/ergast/f1/current.json`
- Standings: `https://api.jolpi.ca/ergast/f1/current/driverstandings.json`
- Race resultater: `https://api.jolpi.ca/ergast/f1/current/last/results.json`
- Ingen API key nødvendig. Rate limit: ~200 req/time.

## Design system
Farver defineret som CSS-variabler i globals.css:
- `--f1-red: #e8002d` (F1 officiel rød)
- `--f1-black: #0a0a0a`
- `--f1-card: #1a1a1a`
Fonts: Barlow Condensed (display) + Barlow (body)

## Næste features at bygge
- [ ] Race resultater (træning, kval, race) — `/api/results`
- [ ] PWA ikoner (192px + 512px PNG)
- [ ] Offline support i service worker
- [ ] Indstillingsside (vælg hvilke sessions man vil have reminder for)
- [ ] Live timing integration via OpenF1 API

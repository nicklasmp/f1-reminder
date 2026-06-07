# 🏎️ F1 Reminder

En PWA der sender push-notifikationer inden Formel 1-sessioner — så du aldrig glemmer en race-weekend igen.

## Features
- 🔔 Push-notifikationer: Onsdag-reminder + 1 time inden hver session
- 📅 Fuld sæsonkalender med alle session-tider (dansk tid)
- 🏆 Driver & Constructor Standings
- 📱 Installérbar PWA (virker på mobil og desktop)

## Tech Stack
Next.js 14 · Supabase · Vercel · cron-job.org · Jolpica F1 API

## Kom i gang
Se `CLAUDE.md` for komplet setup-guide.

```bash
npm install
cp .env.local.example .env.local
# Udfyld .env.local
npm run dev
```

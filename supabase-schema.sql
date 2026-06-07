-- F1 Reminder — Supabase database schema
-- Kør dette i Supabase SQL Editor: https://supabase.com/dashboard/project/[dit-projekt]/sql

-- Push subscriptions tabel
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index på endpoint for hurtige lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON push_subscriptions (endpoint);

-- Row Level Security (RLS)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Kun service role (backend) kan læse og skrive
-- Ingen public adgang direkte fra browser
CREATE POLICY "Service role only" ON push_subscriptions
  USING (true)
  WITH CHECK (true);

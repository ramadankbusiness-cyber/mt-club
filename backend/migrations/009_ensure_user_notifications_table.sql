-- Migration 009: Ensure user_notifications and notification_devices tables exist
-- Idempotent: safe to run on any database state, including empty
-- Auth: Express JWT + SUPABASE_SECRET_KEY (service_role bypasses RLS)

-- ============================================================
-- 1. user_notifications — Per-user notification inbox
-- ============================================================
CREATE TABLE IF NOT EXISTS user_notifications (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  notification_history_id INTEGER REFERENCES notification_history(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  deep_link TEXT,
  image_url TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_member_id ON user_notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON user_notifications(member_id, read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at DESC);

-- ============================================================
-- 2. notification_devices — Multi-device tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_devices (
  id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  onesignal_subscription_id TEXT NOT NULL,
  onesignal_user_id TEXT,
  browser TEXT,
  platform TEXT,
  language TEXT,
  timezone TEXT,
  user_agent TEXT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, onesignal_subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_devices_member_id ON notification_devices(member_id);
CREATE INDEX IF NOT EXISTS idx_notification_devices_subscription_id ON notification_devices(onesignal_subscription_id);

-- ============================================================
-- 3. notification_history — Add category and status columns
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_history' AND column_name = 'category'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN category TEXT DEFAULT 'general';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_history' AND column_name = 'status'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN status TEXT DEFAULT 'sent';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_notification_history_category ON notification_history(category);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);

-- ============================================================
-- 4. RLS — Only service_role policies (backend uses SUPABASE_SECRET_KEY)
--    No authenticated/anon policies: app uses Express JWT, not Supabase Auth
-- ============================================================
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_devices ENABLE ROW LEVEL SECURITY;

-- Drop any broken policies that reference auth.uid() from migration 008
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users read own notifications" ON user_notifications;
  DROP POLICY IF EXISTS "Authenticated users read own notifications" ON notification_devices;
END
$$;

-- Service role policies — backend bypasses RLS entirely, but these ensure safety
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Service role full access on user_notifications'
      AND tablename = 'user_notifications'
  ) THEN
    CREATE POLICY "Service role full access on user_notifications"
      ON user_notifications FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Service role full access on notification_devices'
      AND tablename = 'notification_devices'
  ) THEN
    CREATE POLICY "Service role full access on notification_devices"
      ON notification_devices FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

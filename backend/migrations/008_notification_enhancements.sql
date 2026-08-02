-- Migration 008: Notification system enhancements
-- Creates user_notifications table, adds category/status to history,
-- adds notification_devices for multi-device tracking
-- Safe: uses IF NOT EXISTS, no data loss

-- ============================================================
-- 1. user_notifications — Inbox for per-user notification delivery
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

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on user_notifications'
  ) THEN
    CREATE POLICY "Service role full access on user_notifications"
      ON user_notifications FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- ============================================================
-- 2. Enhance notification_history — add category and status
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'category'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN category TEXT DEFAULT 'general';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'status'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN status TEXT DEFAULT 'sent';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_notification_history_category ON notification_history(category);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);

-- ============================================================
-- 3. notification_devices — Multi-device tracking
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

ALTER TABLE notification_devices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on notification_devices'
  ) THEN
    CREATE POLICY "Service role full access on notification_devices"
      ON notification_devices FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

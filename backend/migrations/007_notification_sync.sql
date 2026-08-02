-- Migration 007: Add notification sync columns to members, delivery tracking, OneSignal user ID
-- Safe: uses IF NOT EXISTS, no data loss

DO $$
BEGIN
  -- Members table: device tracking columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'onesignal_user_id'
  ) THEN
    ALTER TABLE members ADD COLUMN onesignal_user_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'push_browser'
  ) THEN
    ALTER TABLE members ADD COLUMN push_browser TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'push_platform'
  ) THEN
    ALTER TABLE members ADD COLUMN push_platform TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'push_language'
  ) THEN
    ALTER TABLE members ADD COLUMN push_language TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'push_timezone'
  ) THEN
    ALTER TABLE members ADD COLUMN push_timezone TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'push_user_agent'
  ) THEN
    ALTER TABLE members ADD COLUMN push_user_agent TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'push_last_seen'
  ) THEN
    ALTER TABLE members ADD COLUMN push_last_seen TIMESTAMPTZ;
  END IF;

  -- Notification history: delivery tracking columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'delivered_count'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN delivered_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'opened_count'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN opened_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'clicked_count'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN clicked_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'failed_count'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN failed_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'importance'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN importance TEXT DEFAULT 'default';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'channel'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN channel TEXT DEFAULT 'general';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE notification_history ADD COLUMN sent_at TIMESTAMPTZ;
  END IF;
END
$$;

-- Index for faster member lookups by OneSignal ID
CREATE INDEX IF NOT EXISTS idx_members_onesignal_user_id ON members(onesignal_user_id);
CREATE INDEX IF NOT EXISTS idx_members_push_platform ON members(push_platform);
CREATE INDEX IF NOT EXISTS idx_notification_history_importance ON notification_history(importance);
CREATE INDEX IF NOT EXISTS idx_notification_history_channel ON notification_history(channel);

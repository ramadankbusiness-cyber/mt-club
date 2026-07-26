-- notification_history enhanced with analytics fields
-- Run this in Supabase SQL Editor

-- Add new columns to notification_history if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'sent_count') THEN
    ALTER TABLE notification_history ADD COLUMN sent_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'onesignal_id') THEN
    ALTER TABLE notification_history ADD COLUMN onesignal_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'error') THEN
    ALTER TABLE notification_history ADD COLUMN error TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'importance') THEN
    ALTER TABLE notification_history ADD COLUMN importance TEXT DEFAULT 'default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'channel') THEN
    ALTER TABLE notification_history ADD COLUMN channel TEXT DEFAULT 'general';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'delivered_count') THEN
    ALTER TABLE notification_history ADD COLUMN delivered_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'opened_count') THEN
    ALTER TABLE notification_history ADD COLUMN opened_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'clicked_count') THEN
    ALTER TABLE notification_history ADD COLUMN clicked_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'failed_count') THEN
    ALTER TABLE notification_history ADD COLUMN failed_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notification_history' AND column_name = 'sent_at') THEN
    ALTER TABLE notification_history ADD COLUMN sent_at TIMESTAMPTZ;
  END IF;
END
$$;

-- push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access on push_tokens'
  ) THEN
    CREATE POLICY "Service role full access on push_tokens"
      ON push_tokens FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

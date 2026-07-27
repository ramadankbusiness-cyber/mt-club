-- Migration: Add onesignal_id to members table
-- Stores the OneSignal external_id for targeting notifications

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'onesignal_id'
  ) THEN
    ALTER TABLE members ADD COLUMN onesignal_id TEXT;
    CREATE INDEX IF NOT EXISTS idx_members_onesignal_id ON members(onesignal_id);
  END IF;
END
$$;

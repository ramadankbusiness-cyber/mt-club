-- Migration 011: Enhance notification_devices for multi-device tracking
-- Adds active flag, google_id association, updated_at
-- Fully idempotent

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_devices' AND column_name='active') THEN
    ALTER TABLE notification_devices ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_devices' AND column_name='google_id') THEN
    ALTER TABLE notification_devices ADD COLUMN google_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notification_devices' AND column_name='updated_at') THEN
    ALTER TABLE notification_devices ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_notification_devices_active ON notification_devices(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_notification_devices_google_id ON notification_devices(google_id) WHERE google_id IS NOT NULL;

-- Backfill updated_at from last_seen
UPDATE notification_devices SET updated_at = last_seen WHERE updated_at IS NULL AND last_seen IS NOT NULL;

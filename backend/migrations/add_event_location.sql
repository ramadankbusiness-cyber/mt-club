-- Add location and event_code fields to events table
-- Safe to re-run (IF NOT EXISTS)

ALTER TABLE events ADD COLUMN IF NOT EXISTS event_code TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS radius INTEGER DEFAULT 100;

-- Generate unique event_code for existing events that don't have one
DO $$
DECLARE
  ev RECORD;
BEGIN
  FOR ev IN SELECT id FROM events WHERE event_code IS NULL
  LOOP
    UPDATE events SET event_code = 'EVT-' || ev.id || '-' || substr(md5(random()::text), 1, 6)
    WHERE id = ev.id;
  END LOOP;
END $$;

-- Add unique constraint after backfill
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_event_code_key'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_event_code_key UNIQUE (event_code);
  END IF;
END $$;

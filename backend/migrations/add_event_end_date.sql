-- Add optional end_date to events table for multi-day events
-- NULL end_date means the event is a single-day event (date is the start date)
-- Safe to re-run (IF NOT EXISTS)

ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

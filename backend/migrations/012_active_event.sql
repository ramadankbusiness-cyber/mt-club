-- Active event (single source of truth for zone-based attendance)
-- Safe to re-run (IF NOT EXISTS)

-- The event's OWN latitude/longitude/radius are the attendance zone.
-- Mark which event is currently live and accepting attendance checks.
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Index for duplicate check on member + event
CREATE INDEX IF NOT EXISTS idx_attendance_member_event ON attendance(member_id, event_id);

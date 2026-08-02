-- Migration 010: Google Identity authentication
-- Extends members table with Google account fields
-- Fully idempotent — safe to run on any database state

-- ============================================================
-- 1. Add Google columns to members table
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='google_id') THEN
    ALTER TABLE members ADD COLUMN google_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='google_email') THEN
    ALTER TABLE members ADD COLUMN google_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='google_name') THEN
    ALTER TABLE members ADD COLUMN google_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='google_picture') THEN
    ALTER TABLE members ADD COLUMN google_picture TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='google_verified') THEN
    ALTER TABLE members ADD COLUMN google_verified BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='google_linked') THEN
    ALTER TABLE members ADD COLUMN google_linked BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='google_linked_at') THEN
    ALTER TABLE members ADD COLUMN google_linked_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='google_last_login') THEN
    ALTER TABLE members ADD COLUMN google_last_login TIMESTAMPTZ;
  END IF;
END
$$;

-- ============================================================
-- 2. Constraints — unique google_id, unique google_email
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_google_id_unique') THEN
    ALTER TABLE members ADD CONSTRAINT members_google_id_unique UNIQUE (google_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

-- google_email: unique only when not null (multiple nulls allowed)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_google_email_unique') THEN
    ALTER TABLE members ADD CONSTRAINT members_google_email_unique UNIQUE (google_email);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;

-- ============================================================
-- 3. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_members_google_id ON members(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_google_linked ON members(google_linked) WHERE google_linked = TRUE;

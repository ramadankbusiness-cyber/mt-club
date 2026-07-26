-- Fix gallery table schema to match backend expectations
-- Run this in Supabase SQL Editor

-- If gallery table doesn't exist, create it correctly
CREATE TABLE IF NOT EXISTS gallery (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If gallery table exists but is missing 'filename', add it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gallery' AND column_name = 'filename'
  ) = FALSE THEN
    ALTER TABLE gallery ADD COLUMN filename TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- If gallery table exists but is missing 'created_at', add it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gallery' AND column_name = 'created_at'
  ) = FALSE THEN
    ALTER TABLE gallery ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

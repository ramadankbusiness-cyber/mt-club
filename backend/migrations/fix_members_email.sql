-- Run this in Supabase SQL Editor
-- 1. Add committee column to members (if not already run)
ALTER TABLE members ADD COLUMN IF NOT EXISTS committee TEXT DEFAULT NULL;

-- 2. Normalize all existing emails to lowercase
UPDATE members SET email = LOWER(email);

-- 3. Add UNIQUE constraint on email to prevent duplicates
ALTER TABLE members ADD CONSTRAINT members_email_unique UNIQUE (email);

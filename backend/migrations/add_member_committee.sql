-- Add committee column to members table for leader role
-- Run this in Supabase SQL Editor

-- Add committee column (nullable, only used when role = 'leader')
ALTER TABLE members ADD COLUMN IF NOT EXISTS committee TEXT DEFAULT NULL;

-- Update existing admin to ensure role is correct
UPDATE members SET role = 'admin' WHERE role = 'admin';
UPDATE members SET role = 'member' WHERE role = 'member' OR role = 'user';

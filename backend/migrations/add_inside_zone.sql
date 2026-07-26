-- Add inside_zone boolean to attendance table
-- Run this in Supabase SQL Editor
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS inside_zone BOOLEAN DEFAULT NULL;

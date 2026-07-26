-- Add 4 new leader positions to the team table
-- Run this in Supabase SQL Editor if the team table already exists

INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader 1 OC', 0, 17 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader 1 OC');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader 2 OC', 0, 18 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader 2 OC');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader Logistics', 0, 19 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader Logistics');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader HR', 0, 20 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader HR');

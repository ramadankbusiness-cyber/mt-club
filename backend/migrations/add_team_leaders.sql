-- Add leader positions to all committees
-- Every committee: Head, Vice, 1 Leader  --  OC and HR: Head, Vice, 2 Leaders
-- Run this in Supabase SQL Editor (idempotent, safe to re-run)

-- Prevent duplicate roles going forward
CREATE UNIQUE INDEX IF NOT EXISTS team_role_key ON team (role);

-- Convert the old single HR leader into Leader 1 HR (keeps existing name/image)
UPDATE team SET role = 'Leader 1 HR' WHERE role = 'Leader HR';

INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader 1 OC', 0, 17 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader 1 OC');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader 2 OC', 0, 18 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader 2 OC');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader Logistics', 0, 19 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader Logistics');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader Tech', 0, 22 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader Tech');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader PR', 0, 23 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader PR');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader First Aid', 0, 24 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader First Aid');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader Media', 0, 25 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader Media');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader 2 HR', 0, 26 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader 2 HR');

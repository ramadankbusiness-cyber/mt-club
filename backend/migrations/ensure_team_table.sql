-- Ensure the team table exists with correct normalized schema
-- Each committee member is a row with: id, name, role, has_image, sort_order

CREATE TABLE IF NOT EXISTS team (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  has_image SMALLINT DEFAULT 0,
  sort_order INT DEFAULT 0
);

-- Prevent duplicate roles (each committee+position exists exactly once).
-- NOTE: if duplicates already exist, run migrations/dedupe_team.sql first.
CREATE UNIQUE INDEX IF NOT EXISTS team_role_key ON team (role);

-- Ensure 26 rows exist (1 chairman + 8 committees × head + vice + leader, MTC has no leader)
-- Each insert only runs if the role is missing, so it is safe to re-run.
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Chairman', 0, 0 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Chairman');
INSERT INTO team (name, role, has_image, sort_order) SELECT 'Baher Alaa', 'Head MTC', 1, 1 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Head MTC');
INSERT INTO team (name, role, has_image, sort_order) SELECT 'Laila Ziad', 'Vice Head MTC', 1, 2 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Vice Head MTC');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Head OC', 0, 3 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Head OC');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Vice Head OC', 0, 4 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Vice Head OC');
INSERT INTO team (name, role, has_image, sort_order) SELECT 'Mahmoud Sameh', 'Head Tech', 1, 5 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Head Tech');
INSERT INTO team (name, role, has_image, sort_order) SELECT 'Ramadan Kamal', 'Vice Head Tech', 1, 6 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Vice Head Tech');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Head Logistics', 0, 7 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Head Logistics');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Vice Head Logistics', 0, 8 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Vice Head Logistics');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Head Media', 0, 9 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Head Media');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Vice Head Media', 0, 10 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Vice Head Media');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Head First Aid', 0, 11 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Head First Aid');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Vice Head First Aid', 0, 12 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Vice Head First Aid');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Head HR', 0, 13 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Head HR');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Vice Head HR', 0, 14 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Vice Head HR');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Head PR', 0, 15 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Head PR');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Vice Head PR', 0, 16 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Vice Head PR');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader 1 OC', 0, 17 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader 1 OC');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader 2 OC', 0, 18 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader 2 OC');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader Logistics', 0, 19 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader Logistics');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader Tech', 0, 22 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader Tech');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader PR', 0, 23 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader PR');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader First Aid', 0, 24 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader First Aid');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader Media', 0, 25 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader Media');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader 1 HR', 0, 26 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader 1 HR');
INSERT INTO team (name, role, has_image, sort_order) SELECT '', 'Leader 2 HR', 0, 27 WHERE NOT EXISTS (SELECT 1 FROM team WHERE role = 'Leader 2 HR');

-- Ensure uploads bucket exists and is public
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

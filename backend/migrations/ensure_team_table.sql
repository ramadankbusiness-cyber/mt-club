-- Ensure the team table exists with correct normalized schema
-- Each committee member is a row with: id, name, role, has_image, sort_order

CREATE TABLE IF NOT EXISTS team (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  has_image SMALLINT DEFAULT 0,
  sort_order INT DEFAULT 0
);

-- Ensure 21 rows exist (1 chairman + 8 committees × head + vice + 4 leader positions)
INSERT INTO team (name, role, has_image, sort_order) VALUES
('', 'Chairman', 0, 0),
('Baher Alaa', 'Head MTC', 1, 1),
('Laila Ziad', 'Vice Head MTC', 1, 2),
('', 'Head OC', 0, 3),
('', 'Vice Head OC', 0, 4),
('Mahmoud Sameh', 'Head Tech', 1, 5),
('Ramadan Kamal', 'Vice Head Tech', 1, 6),
('', 'Head Logistics', 0, 7),
('', 'Vice Head Logistics', 0, 8),
('', 'Head Media', 0, 9),
('', 'Vice Head Media', 0, 10),
('', 'Head First Aid', 0, 11),
('', 'Vice Head First Aid', 0, 12),
('', 'Head HR', 0, 13),
('', 'Vice Head HR', 0, 14),
('', 'Head PR', 0, 15),
('', 'Vice Head PR', 0, 16),
('', 'Leader 1 OC', 0, 17),
('', 'Leader 2 OC', 0, 18),
('', 'Leader Logistics', 0, 19),
('', 'Leader HR', 0, 20)
ON CONFLICT DO NOTHING;

-- Ensure uploads bucket exists and is public
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO NOTHING;

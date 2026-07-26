-- 1. جدول الأعضاء (members)
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- تم تحويلها لنص متوافق مع الـ Backend
  department TEXT DEFAULT '',
  academic_number TEXT DEFAULT '',
  enabled SMALLINT DEFAULT 1,
  has_image SMALLINT DEFAULT 0,
  profile_image TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول الفعاليات (events)
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  image TEXT,
  locked SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول الحضور (attendance)
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL,
  event_id INT NOT NULL,
  location TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 4. جدول الإنجازات (achievements)
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. جدول اللوجات (logs)
CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  user_id INT,
  action TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES members(id) ON DELETE SET NULL
);

-- 6. جدول الإعدادات (settings)
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  platform TEXT UNIQUE NOT NULL,
  link TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إدخال داتا الإعدادات الافتراضية
INSERT INTO settings (platform, link) VALUES
('facebook', 'https://www.facebook.com/profile.php?id=61566541907259'),
('instagram', 'https://www.instagram.com/mtc_batu/'),
('tiktok', 'https://www.tiktok.com/@mtc.batu')
ON CONFLICT (platform) DO NOTHING;

-- 7. جدول لجان الفريق (team_members)
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  has_image SMALLINT DEFAULT 0,
  sort_order INT DEFAULT 0
);

-- إدخال داتا اللجان الـ 16 الافتراضية (باهر وليلى ومحمود وأنت يا بطل)
INSERT INTO team_members (id, name, role, has_image, sort_order) VALUES
(1, 'Baher Alaa', 'Head MTC', 1, 1),
(2, 'Laila Ziad', 'Vice Head MTC', 1, 2),
(3, '', 'Head OC', 0, 3),
(4, '', 'Vice Head OC', 0, 4),
(5, 'Mahmoud Sameh', 'Head Tech', 1, 5),
(6, 'Ramadan Kamal', 'Vice Head Tech', 1, 6),
(7, '', 'Head Logistics', 0, 7),
(8, '', 'Vice Head Logistics', 0, 8),
(9, '', 'Head Media', 0, 9),
(10, '', 'Vice Head Media', 0, 10),
(11, '', 'Head First Aid', 0, 11),
(12, '', 'Vice Head First Aid', 0, 12),
(13, '', 'Head HR', 0, 13),
(14, '', 'Vice Head HR', 0, 14),
(15, '', 'Head PR', 0, 15),
(16, '', 'Vice Head PR', 0, 16)
ON CONFLICT (id) DO NOTHING;

-- 8. جدول البوستات (posts)
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  date DATE DEFAULT NULL,
  likes INT DEFAULT 0,
  shares INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
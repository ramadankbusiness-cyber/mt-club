-- =============================================
-- MT Club - جميع جداول Supabase
-- شغّل هذا الملف كاملاً في SQL Editor
-- =============================================

-- 1. جدول الأعضاء
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  department TEXT DEFAULT '',
  academic_number TEXT DEFAULT '',
  has_image INTEGER DEFAULT 0,
  profile_image TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول التيم (لجان الفريق) - كل عضو صف منفصل
CREATE TABLE IF NOT EXISTS team (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  has_image SMALLINT DEFAULT 0,
  sort_order INT DEFAULT 0
);

INSERT INTO team (name, role, has_image, sort_order) VALUES
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
('', 'Vice Head PR', 0, 16)
ON CONFLICT DO NOTHING;

-- 3. جدول المنشورات
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  date TEXT DEFAULT NULL,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0
);

-- 4. جدول الأحداث
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  date TEXT DEFAULT NULL,
  image TEXT DEFAULT '',
  qr_code TEXT DEFAULT '',
  event_code TEXT UNIQUE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius INTEGER DEFAULT 100
);

-- 5. جدول الحضور
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  location TEXT DEFAULT 'Unknown'
);

-- 6. جدول المعرض
CREATE TABLE IF NOT EXISTS gallery (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. جدول الإعدادات
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  platform TEXT UNIQUE NOT NULL,
  link TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إدخال الإعدادات الافتراضية (إن لم تكن موجودة)
INSERT INTO settings (platform, link) VALUES
  ('instagram', ''),
  ('facebook', ''),
  ('tiktok', '')
ON CONFLICT (platform) DO NOTHING;

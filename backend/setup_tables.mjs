import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "mtc_site",
});

await pool.query(`CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  platform VARCHAR(50) UNIQUE NOT NULL,
  link VARCHAR(500) DEFAULT '',
  followers INT DEFAULT 0,
  likes INT DEFAULT 0,
  shares INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)`);

await pool.query(`INSERT IGNORE INTO settings (platform, link, followers, likes) VALUES
  ('facebook', 'https://www.facebook.com/profile.php?id=61566541907259', 12000, 5000),
  ('instagram', 'https://www.instagram.com/mtc_batu/', 15000, 7000),
  ('tiktok', 'https://www.tiktok.com/@mtc.batu', 22000, 15000)`);

await pool.query(`CREATE TABLE IF NOT EXISTS posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  date DATE DEFAULT NULL,
  likes INT DEFAULT 0,
  shares INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`);

console.log("Tables created and data inserted");
process.exit(0);

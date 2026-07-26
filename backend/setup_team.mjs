import mysql from "mysql2/promise";
const pool = mysql.createPool({ host: "localhost", user: "root", password: "", database: "mtc_site" });

await pool.query(`CREATE TABLE IF NOT EXISTS team_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(255) NOT NULL,
  has_image TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0
)`);

await pool.query("DELETE FROM team_members");
await pool.query(`INSERT INTO team_members (id, name, role, has_image, sort_order) VALUES
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
(16, '', 'Vice Head PR', 0, 16)`);

console.log("Team members created");
process.exit(0);

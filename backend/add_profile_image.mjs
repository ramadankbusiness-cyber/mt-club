import mysql from "mysql2/promise";
const pool = mysql.createPool({ host: "localhost", user: "root", password: "", database: "mtc_site" });
try { await pool.query("ALTER TABLE members ADD COLUMN profile_image VARCHAR(500) DEFAULT ''"); } catch {}
console.log("column added");
process.exit(0);

import mysql from "mysql2/promise";
const pool = mysql.createPool({ host: "localhost", user: "root", password: "", database: "mtc_site" });

try { await pool.query("ALTER TABLE settings ADD COLUMN api_token VARCHAR(500) DEFAULT ''"); } catch {}
try { await pool.query("ALTER TABLE settings ADD COLUMN page_id VARCHAR(255) DEFAULT ''"); } catch {}

const [rows] = await pool.query("SELECT * FROM settings");
console.table(rows);
process.exit(0);

import mysql from "mysql2/promise";
const pool = mysql.createPool({ host: "localhost", user: "root", password: "", database: "mtc_site" });
const [rows] = await pool.query("SHOW COLUMNS FROM members");
console.table(rows);
process.exit(0);

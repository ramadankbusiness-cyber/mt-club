import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "mtc_site",
});

const password = "admin123";
const hash = await bcrypt.hash(password, 10);

// Verify hash works before insert
const testMatch = await bcrypt.compare(password, hash);
console.log("Hash verification (pre-insert):", testMatch);

await pool.query("DELETE FROM members WHERE email = 'ramadan@mtclub.com'");

await pool.query(
  "INSERT INTO members (club_id, name, email, password, role) VALUES (?, ?, ?, ?, ?)",
  [0, "Ramadan Kamal", "ramadan@mtclub.com", hash, "admin"]
);

// Verify by reading back
const [rows] = await pool.query("SELECT * FROM members WHERE email = 'ramadan@mtclub.com'");
console.log("User in DB:", rows[0]?.name, rows[0]?.role);
const dbMatch = await bcrypt.compare(password, rows[0].password);
console.log("DB hash verification:", dbMatch);

if (dbMatch) {
  console.log("SUCCESS - Login with: ramadan@mtclub.com / admin123");
} else {
  console.log("FAILED - Hash mismatch!");
}

process.exit(0);

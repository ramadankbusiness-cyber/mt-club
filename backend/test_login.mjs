import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "mtc_site",
});

const email = "ramadan@mtclub.com";
const password = "admin123";

try {
  const [rows] = await pool.query("SELECT * FROM members WHERE email = ?", [email]);
  console.log("Rows found:", rows.length);
  if (rows.length === 0) {
    console.log("FAIL: No user found");
    process.exit(1);
  }

  const user = rows[0];
  console.log("User:", user.name, user.role);
  console.log("Hash:", user.password?.substring(0, 30) + "...");

  const match = await bcrypt.compare(password, user.password);
  console.log("Password match:", match);

  if (!match) {
    console.log("FAIL: Password mismatch");
    process.exit(1);
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    "MTCLUB_SECRET",
    { expiresIn: "7d" }
  );

  console.log("Token generated:", token?.substring(0, 30) + "...");
  console.log("SUCCESS: Login would work!");
} catch (err) {
  console.log("ERROR:", err.message);
  console.log("Stack:", err.stack);
}

process.exit(0);

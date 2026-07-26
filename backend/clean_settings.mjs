import mysql from "mysql2/promise";
const pool = mysql.createPool({ host: "localhost", user: "root", password: "", database: "mtc_site" });

try { await pool.query("ALTER TABLE settings DROP COLUMN followers"); } catch (e) { console.log("drop followers:", e.message); }
try { await pool.query("ALTER TABLE settings DROP COLUMN likes"); } catch (e) { console.log("drop likes:", e.message); }
try { await pool.query("ALTER TABLE settings DROP COLUMN shares"); } catch (e) { console.log("drop shares:", e.message); }
try { await pool.query("ALTER TABLE settings DROP COLUMN api_token"); } catch (e) { console.log("drop api_token:", e.message); }
try { await pool.query("ALTER TABLE settings DROP COLUMN page_id"); } catch (e) { console.log("drop page_id:", e.message); }

const [rows] = await pool.query("SELECT * FROM settings");
console.table(rows);
process.exit(0);

import "./config/env.js";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { isVercel } from "./utils/storage.js";
import authRoutes from "./routes/auth.js";
import eventsRoutes from "./routes/events.js";
import attendanceRoutes from "./routes/attendance.js";
import adminRoutes from "./routes/admin.js";
import settingsRoutes from "./routes/settings.js";
import postsRoutes from "./routes/posts.js";
import teamRoutes from "./routes/team.js";
import galleryRoutes from "./routes/gallery.js";
import notificationsRoutes from "./routes/notifications.js";
import { seedAdmin, seedTeam } from "./seed.js";
import { initFirebaseAdmin, getFirebaseConfig } from "./config/firebase-admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
const corsOptions = ALLOWED_ORIGINS.length > 0
  ? { origin: (origin, cb) => { if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true); else cb(new Error("Not allowed by CORS")); }, credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] }
  : { origin: true, credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], allowedHeaders: ["Content-Type", "Authorization"] };

app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));

const imagesPath = path.join(__dirname, "public/images");
if (fs.existsSync(imagesPath)) {
  app.use("/images", express.static(imagesPath));
}

app.use("/api/auth", authRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/notifications", notificationsRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err.stack || err.message || err);
  res.status(500).json({ message: "Internal server error" });
});

const supabaseConfigured = process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY;
console.log("[Config] env vars loaded:", {
  FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT ? "set" : "MISSING",
  SUPABASE_URL: process.env.SUPABASE_URL ? "set" : "MISSING",
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ? "set" : "MISSING",
  JWT_SECRET: process.env.JWT_SECRET ? "set" : "MISSING",
  VERCEL: process.env.VERCEL === "1" ? "yes" : "no",
});

const firebaseApp = initFirebaseAdmin();
const firebaseStatus = getFirebaseConfig();
if (firebaseStatus.initialized) {
  console.log("[Config] Firebase Admin: ✅ configured and initialized");
} else {
  console.error("[Config] Firebase Admin: ❌ NOT CONFIGURED");
  console.error("[Config]   Reason:", firebaseStatus.error || "unknown");
  console.error("[Config]   To fix, set FIREBASE_SERVICE_ACCOUNT=<JSON> in backend/.env");
}

seedAdmin();
seedTeam();

async function ensurePushTokensTable() {
  try {
    const { supabase } = await import("./config/supabase.js");
    if (!supabase) return;
    const { error } = await supabase.from("push_tokens").select("id").limit(1);
    if (!error || !error.message.includes("Could not find the table")) {
      console.log("[DB] push_tokens table: OK");
      return;
    }
    console.error("[DB] push_tokens table MISSING — run this SQL in Supabase SQL Editor:");
    console.error(`
CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;`);
  } catch {}
}
ensurePushTokensTable();

const PORT = process.env.PORT || 5001;

if (!isVercel) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

export default app;

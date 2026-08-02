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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const isDev = process.env.NODE_ENV !== "production";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

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
  if (err.message === "Not allowed by CORS") {
    console.warn(`[CORS] Rejected origin: ${req.headers.origin || "(none)"} — method: ${req.method} — path: ${req.originalUrl}`);
    return res.status(403).json({ message: "Not allowed by CORS" });
  }
  console.error("SERVER ERROR:", err.stack || err.message || err);
  res.status(500).json({ message: "Internal server error" });
});

const onesignalOk = !!(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY);
console.log("[Config] OneSignal:", onesignalOk ? "configured" : "NOT CONFIGURED");

seedAdmin();
seedTeam();

const PORT = process.env.PORT || 5001;

if (!isVercel) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

export default app;

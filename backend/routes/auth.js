import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { supabase } from "../config/supabase.js";
import path from "path";
import { uploadToStorage } from "../utils/storage.js";
import auth from "../middleware/auth.js";
import { requireAdmin } from "../middleware/role.js";
import { calculateUserPoints } from "../utils/points.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("[Auth Route] CRITICAL: JWT_SECRET is not set — login will produce unverifiable tokens");
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again later." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many registration attempts. Please try again later." },
});

const googleLinkLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many Google link attempts. Please try again later." },
});

function logGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  return clientId;
}

async function verifyGoogleToken(tokenId) {
  const clientId = logGoogleConfig();

  if (!tokenId || typeof tokenId !== "string") {
    throw new Error("GOOGLE_VERIFY_FAIL: credential is not a string or is empty");
  }

  if (tokenId.split(".").length !== 3) {
    throw new Error("GOOGLE_VERIFY_FAIL: credential does not look like a JWT (expected 3 dot-separated segments, got " + tokenId.split(".").length + ")");
  }

  if (!clientId) {
    throw new Error("GOOGLE_VERIFY_FAIL: GOOGLE_CLIENT_ID environment variable is not set on the server");
  }

  let client;
  try {
    client = new OAuth2Client(clientId);
  } catch (clientErr) {
    throw new Error(`GOOGLE_VERIFY_FAIL: Failed to create OAuth2Client: ${clientErr.message}`);
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    return payload;
  } catch (err) {
    if (err.message?.includes("Token used too early")) {
      throw new Error("GOOGLE_VERIFY_FAIL: Token not yet valid");
    }
    if (err.message?.includes("Token used too late") || err.message?.includes("expired")) {
      throw new Error("GOOGLE_VERIFY_FAIL: Token expired");
    }
    if (err.message?.includes("Wrong number of segments")) {
      throw new Error("GOOGLE_VERIFY_FAIL: Malformed token structure");
    }
    if (err.message?.includes("Invalid token signature")) {
      throw new Error("GOOGLE_VERIFY_FAIL: Invalid signature");
    }
    if (err.message?.includes("audience mismatch")) {
      throw new Error("GOOGLE_VERIFY_FAIL: Audience mismatch");
    }
    if (err.message?.includes("Invalid issuer")) {
      throw new Error("GOOGLE_VERIFY_FAIL: Invalid issuer");
    }

    throw new Error("GOOGLE_VERIFY_FAIL: Token verification failed");
  }
}

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error("Only .jpg, .jpeg, .png, and .webp files are allowed"));
    }
    cb(null, true);
  },
});

router.post("/register", registerLimiter, async (req, res) => {
  const { name: rawName, email: rawEmail, password } = req.body;
  const name = (rawName || "").trim().slice(0, 100);
  const email = (rawEmail || "").trim().toLowerCase().slice(0, 255);
  if (!email || !password || !name) return res.status(400).json({ message: "Name, email, and password required" });
  if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
  if (password.length > 128) return res.status(400).json({ message: "Password too long" });
  try {
    const { data: existing } = await supabase.from("members").select("id").ilike("email", email).limit(1);
    if (existing && existing.length > 0) return res.status(400).json({ message: "Email already exists" });
    const hashedPassword = await bcrypt.hash(password, 10);
    await supabase.from("members").insert({ name, email, password: hashedPassword });
    res.json({ message: "Registered successfully" });
  } catch (err) {
    console.error("[REGISTER] Error:", err.message);
    res.status(500).json({ message: "Registration failed" });
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase().slice(0, 255);
  const password = req.body.password || "";
  console.log("[LOGIN] Attempt — email:", email);
  if (!email || !password) {
    console.warn("[LOGIN] 400 — missing email or password");
    return res.status(400).json({ message: "Email and password required" });
  }
  try {
    const { data: users, error } = await supabase.from("members").select("*").ilike("email", email);
    if (error) {
      console.error("[LOGIN] 500 — Supabase query error:", error.message);
      return res.status(500).json({ message: "Login failed" });
    }
    if (users.length === 0) {
      console.warn("[LOGIN] 401 — no user found for email:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const user = users[0];
    console.log("[LOGIN] User found — id:", user.id, "| enabled:", user.enabled, "| role:", user.role);
    if (user.enabled === 0 || user.enabled === false) {
      console.warn("[LOGIN] 401 — account disabled for user:", user.id, "| email:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.warn("[LOGIN] 401 — wrong password for user:", user.id, "| email:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, role: user.role, committee: user.committee || null }, JWT_SECRET, { expiresIn: "7d" });
    console.log("[LOGIN] 200 — success for user:", user.id, "| email:", email);
    let points = 0;
    let attendanceCount = 0;
    try {
      const pointsData = await calculateUserPoints(user.id);
      points = pointsData.total;
      attendanceCount = pointsData.attendanceCount;
    } catch {}

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      committee: user.committee || null,
      profile_image: user.profile_image || "",
      points,
      attendanceCount,
      token,
      googleSub: user.google_id || null,
      googleVerified: user.google_verified || false,
    });
  } catch (err) {
    console.error("[LOGIN] 500 — unexpected error:", err.message, err.stack);
    res.status(500).json({ message: "Login failed" });
  }
});

router.get("/profile", auth, async (req, res) => {
  try {
    const { data: user, error } = await supabase.from("members").select("id, name, email, role, profile_image, google_id, google_linked, google_email, google_name, google_picture, google_verified, google_linked_at").eq("id", req.user.id).single();
    if (error) {
      return res.status(500).json({ message: "Failed to load profile" });
    }
    if (!user) return res.status(404).json({ message: "User not found" });
    try {
      const { data: fullUser } = await supabase.from("members").select("committee").eq("id", req.user.id).single();
      user.committee = fullUser?.committee || null;
    } catch {
      user.committee = null;
    }
    try {
      const pointsData = await calculateUserPoints(req.user.id);
      user.points = pointsData.total;
      user.attendanceCount = pointsData.attendanceCount;
    } catch {
      user.points = 0;
      user.attendanceCount = 0;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to load profile" });
  }
});

router.put("/profile", auth, async (req, res) => {
  const { name: rawName } = req.body;
  const name = (rawName || "").trim().slice(0, 100);
  try {
    await supabase.from("members").update({ name: name || "" }).eq("id", req.user.id);
    const { data: user, error } = await supabase.from("members").select("id, name, email, role, profile_image").eq("id", req.user.id).single();
    if (error) {
      return res.status(500).json({ message: "Failed to update profile" });
    }
    try {
      const { data: fullUser } = await supabase.from("members").select("committee").eq("id", req.user.id).single();
      user.committee = fullUser?.committee || null;
    } catch {
      user.committee = null;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.post("/profile/image", auth, (req, res) => {
  profileUpload.single("image")(req, res, async (err) => {
    if (err) {
      const message = err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 5 MB."
        : err.message;
      return res.status(400).json({ message });
    }
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    try {
      const ext = path.extname(req.file.originalname).toLowerCase();
      const safeExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : ".png";
      const filename = `user-${req.user.id}-${Date.now()}${safeExt}`;
      const imageUrl = await uploadToStorage("profiles", filename, req.file.buffer, req.file.mimetype);
      await supabase.from("members").update({ profile_image: imageUrl }).eq("id", req.user.id);
      res.json({ profile_image: imageUrl });
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });
});

router.put("/change-password", auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ message: "Old and new password required" });
  if (newPassword.length < 6) return res.status(400).json({ message: "New password must be at least 6 characters" });
  if (newPassword.length > 128) return res.status(400).json({ message: "New password too long" });
  try {
    const { data: users, error } = await supabase.from("members").select("password").eq("id", req.user.id).limit(1);
    if (error) return res.status(500).json({ message: "Failed to change password" });
    const user = users?.[0];
    if (!user) return res.status(404).json({ message: "User not found" });
    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(400).json({ message: "Old password is incorrect" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await supabase.from("members").update({ password: hashed }).eq("id", req.user.id);
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to change password" });
  }
});

// ─── Google Account Linking (Mandatory) ─────────────────────────

router.post("/google/link", auth, googleLinkLimiter, async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ message: "Google credential required" });

  try {
    const payload = await verifyGoogleToken(credential);
    if (!payload || !payload.sub) {
      return res.status(401).json({ message: "Invalid Google credential" });
    }

    const { sub: googleSub, email: googleEmail, name: googleName, picture: googlePicture, email_verified } = payload;

    // Reject if this Google account is already linked to ANOTHER member
    const { data: existingGoogle } = await supabase
      .from("members")
      .select("id, email")
      .eq("google_id", googleSub)
      .limit(1)
      .maybeSingle();

    if (existingGoogle && existingGoogle.id !== req.user.id) {
      return res.status(409).json({
        message: "This Google account is already linked to another member",
        existingEmail: existingGoogle.email,
      });
    }

    // Check if already linked to THIS user (idempotent)
    const { data: currentUser } = await supabase
      .from("members")
      .select("google_id")
      .eq("id", req.user.id)
      .limit(1)
      .maybeSingle();

    if (currentUser?.google_id && currentUser.google_id === googleSub) {
      return res.json({
        message: "Google account already linked",
        linked: true,
        googleSub,
        googleVerified: true,
      });
    }

    if (currentUser?.google_id && currentUser.google_id !== googleSub) {
      return res.status(409).json({
        message: "This account is already linked to a different Google account",
        code: "ALREADY_LINKED_DIFFERENT",
      });
    }

    // Link Google account — store google_sub permanently
    const { error: linkError } = await supabase
      .from("members")
      .update({
        google_id: googleSub,
        google_email: googleEmail,
        google_name: googleName,
        google_picture: googlePicture,
        google_verified: !!email_verified,
        google_linked: true,
        google_linked_at: new Date().toISOString(),
      })
      .eq("id", req.user.id);

    if (linkError) {
      console.error("[GOOGLE] Link error:", linkError.message);
      return res.status(500).json({ message: "Failed to link Google account" });
    }

    console.log(`[GOOGLE] User ${req.user.id} linked Google account`);

    res.json({
      message: "Google account linked successfully",
      linked: true,
      googleSub,
      googleVerified: !!email_verified,
    });
  } catch (err) {
    const isVerifyFail = err.message?.startsWith("GOOGLE_VERIFY_FAIL:");
    const detail = isVerifyFail ? err.message : "GOOGLE_VERIFY_FAIL: Internal error";
    res.status(401).json({
      message: "Google verification failed",
      detail,
      code: isVerifyFail ? "VERIFICATION_FAILED" : "INTERNAL_ERROR",
    });
  }
});

router.get("/google/status", auth, async (req, res) => {
  try {
    const { data: member } = await supabase
      .from("members")
      .select("google_id, google_linked, google_email, google_name, google_picture, google_verified, google_linked_at")
      .eq("id", req.user.id)
      .limit(1)
      .maybeSingle();

    if (!member) return res.status(404).json({ message: "User not found" });

    res.json({
      googleSub: member.google_id || null,
      linked: member.google_linked || false,
      verified: member.google_verified || false,
      email: member.google_email || null,
      name: member.google_name || null,
      picture: member.google_picture || null,
      linkedAt: member.google_linked_at || null,
    });
  } catch (err) {
    console.error("[GOOGLE] Status error:", err.message);
    res.status(500).json({ message: "Failed to get Google status" });
  }
});

router.delete("/google/unlink", auth, async (req, res) => {
  if (!supabase) {
    return res.status(503).json({ message: "Database unavailable" });
  }
  try {
    const { error } = await supabase
      .from("members")
      .update({
        google_id: null,
        google_email: null,
        google_name: null,
        google_picture: null,
        google_verified: false,
        google_linked: false,
        google_linked_at: null,
      })
      .eq("id", req.user.id);

    if (error) {
      console.error("[GOOGLE] Unlink DB error:", error.message);
      return res.status(500).json({ message: "Failed to unlink Google account" });
    }

    res.json({ unlinked: true, message: "Google account unlinked" });
  } catch (err) {
    console.error("[GOOGLE] Unlink error:", err.message);
    res.status(500).json({ message: "Failed to unlink Google account" });
  }
});

router.get("/google/diag", auth, (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  res.json({
    serverClientIdLoaded: !!clientId,
    serverClientIdPrefix: clientId ? clientId.substring(0, 20) + "..." : "(empty)",
    serverClientIdLength: clientId.length,
    serverTime: new Date().toISOString(),
    timestamp: Date.now(),
  });
});

export default router;

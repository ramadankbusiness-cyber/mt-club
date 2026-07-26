import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { supabase } from "../config/supabase.js";
import path from "path";
import { uploadToStorage } from "../utils/storage.js";
import auth from "../middleware/auth.js";
import { calculateUserPoints } from "../utils/points.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("[Auth Route] CRITICAL: JWT_SECRET is not set — login will produce unverifiable tokens");
}

const profileUpload = multer({ storage: multer.memoryStorage() });

router.post("/register", async (req, res) => {
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

router.post("/login", async (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase().slice(0, 255);
  const password = req.body.password || "";
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });
  try {
    const { data: users, error } = await supabase.from("members").select("*").ilike("email", email);
    if (error) {
      return res.status(500).json({ message: "Login failed" });
    }
    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const user = users[0];
    if (user.enabled === 0 || user.enabled === false) {
      return res.status(403).json({ message: "Your account has been disabled. Contact an admin." });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, role: user.role, committee: user.committee || null }, JWT_SECRET, { expiresIn: "7d" });
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
    });
  } catch (err) {
    res.status(500).json({ message: "Login failed" });
  }
});

router.get("/profile", auth, async (req, res) => {
  try {
    const { data: user, error } = await supabase.from("members").select("id, name, email, role, profile_image").eq("id", req.user.id).single();
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
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    try {
      const ext = path.extname(req.file.originalname) || ".png";
      const filename = `user-${req.user.id}${ext}`;
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

export default router;

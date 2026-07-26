import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAdmin } from "../middleware/role.js";
import path from "path";
import { createMulter, saveUpload, getPublicUrl } from "../utils/storage.js";
import { sendPushToAll } from "../utils/pushSender.js";

const router = express.Router();

const upload = createMulter("events", (req, file, cb) => {
  const ext = path.extname(file.originalname) || ".jpg";
  cb(null, `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
});

router.get("/", async (req, res) => {
  try {
    const { data } = await supabase.from("events").select("*").order("date", { ascending: false, nullsFirst: false });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch events" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { data: event } = await supabase.from("events").select("*").eq("id", req.params.id).single();
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch event" });
  }
});

router.post("/", requireAdmin, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: "Upload failed" });
    const { title, description, date, latitude, longitude, radius, attendance_points } = req.body;
    const sanitizedTitle = (title || "").trim().slice(0, 200);
    if (!sanitizedTitle) return res.status(400).json({ message: "Title is required" });
    if (req.file) {
      try {
        await saveUpload(req.file, "events", req.file.filename);
      } catch (e) {
        return res.status(500).json({ message: "Failed to save file" });
      }
    }
    const imageUrl = req.file ? getPublicUrl("uploads", `events/${req.file.filename}`) : "";
    try {
      const { data, error: insertErr } = await supabase
        .from("events")
        .insert({
          title: sanitizedTitle,
          description: (description || "").slice(0, 2000),
          date,
          image: imageUrl,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          radius: radius ? parseInt(radius) : 100,
          attendance_points: attendance_points ? parseInt(attendance_points) : 2,
        })
        .select()
        .single();
      if (insertErr) {
        return res.status(500).json({ message: "Failed to save event" });
      }
      sendPushToAll({
        title: "New Event",
        body: `A new event "${sanitizedTitle}" has been created`,
        importance: "high",
        channel: "events",
        data: { screen: "events", id: String(data.id) },
      }, req.user?.id).catch((err) => console.error("[Events] Auto-push failed:", err.message));
      res.json({ id: data.id, image: imageUrl });
    } catch (e) {
      res.status(500).json({ message: "Failed to save event" });
    }
  });
});

export default router;

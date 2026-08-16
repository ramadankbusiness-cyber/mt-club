import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAdmin } from "../middleware/role.js";
import path from "path";
import { createMulter, saveUpload, getPublicUrl, deleteUpload } from "../utils/storage.js";
import { sendToAll } from "../utils/onesignal.js";

const router = express.Router();

const upload = createMulter("events", (req, file, cb) => {
  const ext = path.extname(file.originalname) || ".jpg";
  cb(null, `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
});

function logError(context, err) {
  console.error(`[Events] ${context}`, {
    message: err?.message,
    name: err?.name,
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    stack: err?.stack,
  });
}

async function cleanupOrphanUpload(filename) {
  if (!filename) return;
  try {
    await deleteUpload("events", filename);
    console.log(`[Events] Cleaned up orphaned upload: ${filename}`);
  } catch (e) {
    console.warn(`[Events] Orphan cleanup failed for ${filename}:`, e?.message);
  }
}

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: false, nullsFirst: false });
    if (error) {
      logError("GET /api/events — select error", error);
      return res.status(500).json({ message: "Failed to fetch events" });
    }
    res.json(data || []);
  } catch (err) {
    logError("GET /api/events — exception", err);
    res.status(500).json({ message: "Failed to fetch events" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { data: event, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", req.params.id)
      .single();
    if (!event) {
      if (error && error.code !== "PGRST116") {
        logError(`GET /api/events/${req.params.id} — select error`, error);
      }
      return res.status(404).json({ message: "Event not found" });
    }
    if (error) {
      logError(`GET /api/events/${req.params.id} — select error`, error);
      return res.status(500).json({ message: "Failed to fetch event" });
    }
    res.json(event);
  } catch (err) {
    logError(`GET /api/events/${req.params.id} — exception`, err);
    res.status(500).json({ message: "Failed to fetch event" });
  }
});

router.post("/", requireAdmin, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      logError("POST /api/events — multer error", err);
      return res.status(400).json({ message: "Upload failed" });
    }

    const { title, description, date, end_date, latitude, longitude, radius, attendance_points, is_active } = req.body;
    const sanitizedTitle = (title || "").trim().slice(0, 200);
    if (!sanitizedTitle) return res.status(400).json({ message: "Title is required" });

    const startDate = date ? new Date(date) : null;
    const endDate = end_date ? new Date(end_date) : null;
    if (endDate && startDate && isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "End date is invalid" });
    }
    if (endDate && startDate && !isNaN(startDate.getTime()) && endDate < startDate) {
      return res.status(400).json({ message: "End date must be on or after the start date" });
    }

    let uploadedFilename = req.file?.filename || null;

    if (req.file) {
      console.log(
        `[Events] Step 1/6 — uploading image | original: ${req.file.originalname} | size: ${req.file.size} bytes | filename: ${uploadedFilename}`
      );
      try {
        await saveUpload(req.file, "events", req.file.filename);
        console.log(`[Events] Step 2/6 — image uploaded OK | filename: ${uploadedFilename}`);
      } catch (e) {
        logError("POST /api/events — Step 2/6 upload failed", e);
        return res.status(500).json({ message: "Failed to save file" });
      }
    }

    const imageUrl = req.file ? getPublicUrl("uploads", `events/${req.file.filename}`) : "";

    const payload = {
      title: sanitizedTitle,
      description: (description || "").slice(0, 2000),
      date,
      end_date: end_date || null,
      image: imageUrl,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      radius: radius ? parseInt(radius) : 100,
      attendance_points: attendance_points ? parseInt(attendance_points) : 2,
      is_active: is_active === undefined ? true : (is_active === true || is_active === "true"),
    };

    console.log(`[Events] Step 3/6 — inserting event | payload: ${JSON.stringify(payload)}`);

    let data;
    try {
      const result = await supabase
        .from("events")
        .insert(payload)
        .select()
        .single();
      data = result.data;
      if (result.error) {
        logError("POST /api/events — Step 3/6 insert failed", result.error);
        if (uploadedFilename) await cleanupOrphanUpload(uploadedFilename);
        return res.status(500).json({ message: "Failed to save event" });
      }
    } catch (e) {
      logError("POST /api/events — Step 3/6 insert threw", e);
      if (uploadedFilename) await cleanupOrphanUpload(uploadedFilename);
      return res.status(500).json({ message: "Failed to save event" });
    }

    if (!data || data.id == null) {
      console.error(
        `[Events] Step 4/6 — insert returned no row | raw data: ${JSON.stringify(data)}`
      );
      if (uploadedFilename) await cleanupOrphanUpload(uploadedFilename);
      return res.status(500).json({ message: "Failed to save event" });
    }

    console.log(`[Events] Step 4/6 — insert OK | event id: ${data.id}`);

    console.log(`[Events] Step 5/6 — firing push notification | event id: ${data.id}`);
    sendToAll(
      {
        title: "New Event",
        body: `A new event "${sanitizedTitle}" has been created`,
        priority: "high",
        deepLink: `/events/${data.id}`,
        data: { screen: "events", id: String(data.id) },
      },
      req.user?.id
    )
      .then(() => console.log(`[Events] Step 6/6 — push notification sent | event id: ${data.id}`))
      .catch((e) => logError(`[Events] Step 6/6 — auto-push failed (non-fatal) | event id: ${data.id}`, e));

    res.json({ id: data.id, image: imageUrl });
  });
});

export default router;

import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAdmin, requireLeaderOrAdmin } from "../middleware/role.js";
import path from "path";
import { createMulter, saveUpload, deleteUpload, getPublicUrl } from "../utils/storage.js";

const router = express.Router();

const upload = createMulter("gallery", (req, file, cb) => {
  const ext = path.extname(file.originalname) || ".jpg";
  cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
});

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase.from("gallery").select("id, image_url, created_at").order("created_at", { ascending: false });
    if (error) {
      return res.status(500).json({ message: "Failed to fetch gallery" });
    }
    const rows = (data || []).map(({ id, image_url, created_at }) => ({ id, filename: image_url, created_at }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch gallery" });
  }
});

router.post("/", requireLeaderOrAdmin, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) return res.status(400).json({ message: "Upload failed" });
    if (!req.file) return res.status(400).json({ message: "No file" });
    try {
      await saveUpload(req.file, "gallery", req.file.filename);
      const url = getPublicUrl("uploads", `gallery/${req.file.filename}`);
      if (!url || typeof url !== "string" || url.length === 0) {
        return res.status(500).json({ message: "Failed to generate image URL" });
      }
      const { data, error: insertErr } = await supabase.from("gallery").insert({ image_url: url }).select("id, image_url, created_at").single();
      if (insertErr) {
        return res.status(500).json({ message: "Failed to save gallery record" });
      }
      res.json({ id: data.id, filename: data.image_url });
    } catch (e) {
      res.status(500).json({ message: "Upload failed" });
    }
  });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { data: row, error: selErr } = await supabase.from("gallery").select("image_url").eq("id", req.params.id).single();
    if (selErr) {
      return res.status(500).json({ message: "Failed to find gallery record" });
    }
    if (row) {
      const filename = path.basename(row.image_url);
      await deleteUpload("gallery", filename);
    }
    const { error: delErr } = await supabase.from("gallery").delete().eq("id", req.params.id);
    if (delErr) {
      return res.status(500).json({ message: "Failed to delete gallery record" });
    }
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete gallery record" });
  }
});

export default router;

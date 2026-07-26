import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAdmin } from "../middleware/role.js";
import { sendPushToAll } from "../utils/pushSender.js";

const router = express.Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { data } = await supabase.from("posts").select("*").order("date", { ascending: false, nullsFirst: false });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  const { title: rawTitle, platform, date, likes, shares } = req.body;
  const title = (rawTitle || "").trim().slice(0, 200);
  const sanitizedPlatform = (platform || "").trim().slice(0, 50);
  if (!title || !sanitizedPlatform) return res.status(400).json({ message: "Title and platform required" });
  try {
    const { data } = await supabase
      .from("posts")
      .insert({ title, platform: sanitizedPlatform, date: date || null, likes: likes || 0, shares: shares || 0 })
      .select()
      .single();
    sendPushToAll({
      title: "New Post",
      body: `New ${sanitizedPlatform} post: "${title}"`,
      importance: "default",
      channel: "general",
      data: { screen: "home" },
    }, req.user?.id).catch((err) => console.error("[Posts] Auto-push failed:", err.message));
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to create post" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await supabase.from("posts").delete().eq("id", req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete post" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  const { title: rawTitle, platform, date, likes, shares } = req.body;
  const title = (rawTitle || "").trim().slice(0, 200);
  const sanitizedPlatform = (platform || "").trim().slice(0, 50);
  try {
    const { data } = await supabase
      .from("posts")
      .update({ title, platform: sanitizedPlatform, date, likes: likes || 0, shares: shares || 0 })
      .eq("id", req.params.id)
      .select()
      .single();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Failed to update post" });
  }
});

export default router;

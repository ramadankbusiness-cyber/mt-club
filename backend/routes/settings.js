import express from "express";
import { supabase } from "../config/supabase.js";
import { requireAdmin } from "../middleware/role.js";

const router = express.Router();

router.get("/", requireAdmin, async (req, res) => {
  try {
    const { data } = await supabase.from("settings").select("id, platform, link, updated_at").order("id");
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});

router.put("/:platform", requireAdmin, async (req, res) => {
  const { link: rawLink } = req.body;
  const link = (rawLink || "").trim().slice(0, 500);
  const platform = (req.params.platform || "").trim().slice(0, 50);
  try {
    await supabase
      .from("settings")
      .update({ link, updated_at: new Date().toISOString() })
      .eq("platform", platform);
    const { data } = await supabase
      .from("settings")
      .select("id, platform, link, updated_at")
      .eq("platform", platform)
      .single();
    res.json(data || { platform, link });
  } catch (err) {
    res.status(500).json({ message: "Failed to update settings" });
  }
});

export default router;

import express from "express";
import { supabase } from "../config/supabase.js";
import auth from "../middleware/auth.js";
import { requireAdmin } from "../middleware/role.js";
import { sendPush, IMPORTANCE_MAP, CHANNEL_MAP } from "../utils/pushSender.js";
import { getFirebaseConfig } from "../config/firebase-admin.js";

const router = express.Router();

router.post("/register", auth, async (req, res) => {
  const { token, platform } = req.body;
  if (!token || !platform) return res.status(400).json({ message: "token and platform required" });
  if (!["android", "ios", "web"].includes(platform)) return res.status(400).json({ message: "platform must be android, ios, or web" });

  try {
    const { data: existing } = await supabase
      .from("push_tokens").select("id").eq("user_id", req.user.id).eq("token", token).maybeSingle();

    if (existing) {
      const { error } = await supabase.from("push_tokens").update({ updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) return res.status(500).json({ message: "Failed to update token" });
      return res.json({ message: "Token refreshed" });
    }

    await supabase.from("push_tokens").delete().eq("user_id", req.user.id);

    const { error } = await supabase.from("push_tokens").insert({ user_id: req.user.id, token, platform });
    if (error) return res.status(500).json({ message: "Failed to register token" });
    console.log(`[Push] Registered: user=${req.user.id} platform=${platform} token=${token.substring(0, 20)}...`);
    res.json({ message: "Token registered" });
  } catch (err) {
    console.error("[Push] Register error:", err.message);
    res.status(500).json({ message: "Failed to register token" });
  }
});

router.delete("/unregister", auth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: "token required" });

  try {
    const { error } = await supabase.from("push_tokens").delete().eq("user_id", req.user.id).eq("token", token);
    if (error) return res.status(500).json({ message: "Failed to remove token" });
    res.json({ message: "Token removed" });
  } catch {
    res.status(500).json({ message: "Failed to remove token" });
  }
});

router.post("/send", requireAdmin, async (req, res) => {
  try {
    const { title, body, subtitle, image, largeIcon, smallIcon, bigPicture,
      badge, sound, vibration, priority, ttl, collapseId, deepLink,
      launchUrl, buttons, channel, category, data, importance, target, targetValue, schedule } = req.body;

    if (!title || !body) return res.status(400).json({ message: "title and body are required" });

    const options = { title, body, subtitle, image, largeIcon, smallIcon, bigPicture,
      badge, sound, vibration, priority, ttl, collapseId, deepLink,
      launchUrl, buttons, channel, category, data, importance };

    const result = await sendPush(options, req.user.id);

    res.json({
      message: result.error ? "Notification sent with issues" : "Notification sent",
      sent: result.sent,
      errors: result.failed || 0,
      error: result.error || null,
      totalMembers: result.totalMembers || 0,
      membersWithDevice: result.membersWithDevice || 0,
      membersWithoutDevice: result.membersWithoutDevice || 0,
    });
  } catch (err) {
    console.error("[Push] Send error:", err.message);
    res.status(500).json({ message: "Failed to send notification", error: err.message });
  }
});

router.delete("/clear-tokens", requireAdmin, async (_req, res) => {
  try {
    const { count, error } = await supabase.from("push_tokens").delete().neq("id", 0).select("id");
    if (error) return res.status(500).json({ message: "Failed to clear tokens", error: error.message });
    console.log(`[Push] Admin cleared ${count || 0} tokens from push_tokens`);
    res.json({ message: "All tokens cleared", removed: count || 0 });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear tokens", error: err.message });
  }
});

router.delete("/cancel/:notificationId", requireAdmin, (_req, res) => {
  res.status(400).json({ message: "Scheduled notifications not supported with FCM" });
});

router.get("/history", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from("notification_history")
      .select("*, members!sent_by(name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ message: "Failed to fetch history" });
    res.json({ data, total: count || 0, page, limit });
  } catch {
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

router.delete("/history", requireAdmin, async (_req, res) => {
  try {
    const { count, error } = await supabase.from("notification_history").delete().neq("id", 0).select("id");
    if (error) return res.status(500).json({ success: false, message: "Failed to clear notification history", error: error.message });
    console.log(`[Push] Admin cleared ${count || 0} notification history records`);
    res.json({ success: true, deleted: count || 0 });
  } catch (err) {
    console.error("[Push] Clear history error:", err.message);
    res.status(500).json({ success: false, message: "Failed to clear notification history", error: err.message });
  }
});

router.get("/stats", requireAdmin, async (_req, res) => {
  try {
    const { data: members, error: membersError } = await supabase
      .from("members").select("id");

    if (membersError) return res.status(500).json({ message: "Failed to fetch stats" });

    const totalMembers = members?.length || 0;

    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens").select("user_id");

    if (tokenError) return res.status(500).json({ message: "Failed to fetch stats" });

    const membersWithPush = new Set((tokens || []).map((t) => t.user_id)).size;
    const membersWithoutPush = totalMembers - membersWithPush;

    const { count: historyCount } = await supabase
      .from("notification_history").select("id", { count: "exact", head: true });

    const { data: recentHistory } = await supabase
      .from("notification_history").select("sent_count").order("created_at", { ascending: false }).limit(100);

    const totalDelivered = (recentHistory || []).reduce((sum, h) => sum + (h.sent_count || 0), 0);

    res.json({ totalMembers, membersWithPush, membersWithoutPush, totalNotificationsSent: historyCount || 0, totalDelivered });
  } catch {
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

router.get("/channels", requireAdmin, (_req, res) => res.json(CHANNEL_MAP));

router.get("/importance", requireAdmin, (_req, res) => {
  res.json(Object.entries(IMPORTANCE_MAP).map(([key, val]) => ({ value: key, label: key.charAt(0).toUpperCase() + key.slice(1), ...val })));
});

router.get("/config-status", requireAdmin, (_req, res) => res.json(getFirebaseConfig()));

export default router;

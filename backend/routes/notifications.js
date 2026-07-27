import express from "express";
import { supabase } from "../config/supabase.js";
import auth from "../middleware/auth.js";
import { requireAdmin } from "../middleware/role.js";
import { sendToAll, sendToUser, sendToUsers, sendToCommittee, sendToSegment, getConfig } from "../utils/onesignal.js";

const router = express.Router();

const WELCOME_TITLE = "🎉 أهلاً بيك في MT Club";
const WELCOME_BODY = "نتمنى لك تجربة ممتعة داخل MT Club. تابع الفعاليات، سجل حضورك، واجمع النقاط واستمتع بكل جديد. 💙";

async function sendWelcomeIfFirstTime(userId) {
  try {
    const { data: existing, error: queryError } = await supabase
      .from("notification_history")
      .select("id")
      .eq("target", "user")
      .eq("target_value", String(userId))
      .eq("title", WELCOME_TITLE)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error("[OneSignal] Welcome check error:", queryError.message);
      return;
    }
    if (existing) return;

    console.log(`[OneSignal] Sending welcome notification to user ${userId}`);
    await sendToUser(userId, { title: WELCOME_TITLE, body: WELCOME_BODY });
  } catch (err) {
    console.error("[OneSignal] Welcome notification error:", err.message);
  }
}

router.post("/register", auth, async (req, res) => {
  const { platform } = req.body;
  console.log(`[OneSignal] User ${req.user.id} registered via OneSignal (platform: ${platform || "web"})`);
  sendWelcomeIfFirstTime(req.user.id).catch(() => {});
  res.json({ message: "User registered for notifications" });
});

router.delete("/unregister", auth, async (req, res) => {
  console.log(`[OneSignal] User ${req.user.id} unregistered from notifications`);
  res.json({ message: "User unregistered from notifications" });
});

router.post("/save-oneSignal-id", auth, async (req, res) => {
  try {
    const { onesignalId } = req.body;
    if (!onesignalId) return res.status(400).json({ message: "onesignalId is required" });

    const { error } = await supabase
      .from("members")
      .update({ onesignal_id: String(onesignalId) })
      .eq("id", req.user.id);

    if (error) {
      console.error("[OneSignal] Save ID error:", error.message);
      return res.status(500).json({ message: "Failed to save OneSignal ID" });
    }

    console.log(`[OneSignal] Saved OneSignal ID for user ${req.user.id}: ${onesignalId}`);
    res.json({ message: "OneSignal ID saved" });
  } catch (err) {
    console.error("[OneSignal] Save ID exception:", err.message);
    res.status(500).json({ message: "Failed to save OneSignal ID" });
  }
});

router.post("/send", requireAdmin, async (req, res) => {
  try {
    const { title, body, subtitle, image, largeIcon, deepLink,
      priority, ttl, buttons, target, targetValue, schedule } = req.body;

    if (!title || !body) return res.status(400).json({ message: "title and body are required" });

    const options = { title, body, subtitle, image, largeIcon, deepLink, priority, ttl, buttons, schedule };

    let result;

    switch (target) {
      case "user":
        if (!targetValue) return res.status(400).json({ message: "targetValue required for user target" });
        result = await sendToUser(targetValue, options);
        break;

      case "multiple_users": {
        if (!targetValue) return res.status(400).json({ message: "targetValue required for multiple_users target" });
        const userIds = targetValue.split(",").map((s) => s.trim()).filter(Boolean);
        if (userIds.length === 0) return res.status(400).json({ message: "No valid user IDs provided" });
        result = await sendToUsers(userIds, options);
        break;
      }

      case "committee":
        if (!targetValue) return res.status(400).json({ message: "targetValue required for committee target" });
        result = await sendToCommittee(targetValue, options);
        break;

      case "segment":
        if (!targetValue) return res.status(400).json({ message: "targetValue (segment name) required" });
        result = await sendToSegment(targetValue, options);
        break;

      case "external_id":
        if (!targetValue) return res.status(400).json({ message: "targetValue (external ID) required" });
        result = await sendToUser(targetValue, options);
        break;

      case "all":
      default:
        result = await sendToAll(options, req.user.id);
        break;
    }

    res.json({
      message: result.error ? "Notification sent with issues" : "Notification sent",
      sent: result.sent,
      errors: result.failed || 0,
      error: result.error || null,
    });
  } catch (err) {
    console.error("[OneSignal] Send error:", err.message);
    res.status(500).json({ message: "Failed to send notification", error: err.message });
  }
});

router.delete("/clear-tokens", requireAdmin, async (_req, res) => {
  res.json({ message: "OneSignal manages subscriptions server-side. No local tokens to clear.", removed: 0 });
});

router.delete("/cancel/:notificationId", requireAdmin, (_req, res) => {
  res.status(400).json({ message: "Scheduled notification cancellation is not supported via OneSignal REST API" });
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
    if (error) return res.status(500).json({ success: false, message: "Failed to clear history", error: error.message });
    console.log(`[OneSignal] Admin cleared ${count || 0} notification history records`);
    res.json({ success: true, deleted: count || 0 });
  } catch (err) {
    console.error("[OneSignal] Clear history error:", err.message);
    res.status(500).json({ success: false, message: "Failed to clear history", error: err.message });
  }
});

router.get("/stats", requireAdmin, async (_req, res) => {
  try {
    const { data: members, error: membersError } = await supabase
      .from("members").select("id");

    if (membersError) return res.status(500).json({ message: "Failed to fetch stats" });

    const totalMembers = members?.length || 0;

    const { count: historyCount } = await supabase
      .from("notification_history").select("id", { count: "exact", head: true });

    const { data: recentHistory } = await supabase
      .from("notification_history").select("sent_count").order("created_at", { ascending: false }).limit(100);

    const totalDelivered = (recentHistory || []).reduce((sum, h) => sum + (h.sent_count || 0), 0);

    res.json({
      totalMembers,
      membersWithPush: totalMembers,
      membersWithoutPush: 0,
      totalNotificationsSent: historyCount || 0,
      totalDelivered,
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

router.get("/config-status", requireAdmin, (_req, res) => res.json(getConfig()));

export default router;

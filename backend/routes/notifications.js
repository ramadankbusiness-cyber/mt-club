import express from "express";
import { supabase } from "../config/supabase.js";
import auth from "../middleware/auth.js";
import { requireAdmin, requireLeaderOrAdmin } from "../middleware/role.js";
import {
  sendToAll, sendToUser, sendToUsers, sendToCommittee,
  sendToSegment, sendToRole, sendToTag, sendToExternalIds,
  getConfig, getSubscribedCount, buildUserNotificationRecords,
  getGoogleIdForMember,
  resolveTargetMembers, createInboxRecords, sendPushViaOneSignal,
  recordHistory,
} from "../utils/onesignal.js";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || "";
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || "";

const router = express.Router();

const WELCOME_TITLE = "Welcome to MT Club";
const WELCOME_BODY = "We are glad to have you here! Follow events, track attendance, and earn points.";

async function sendWelcomeIfFirstTime(userId) {
  if (!supabase) return;
  try {
    const { data: member } = await supabase
      .from("members")
      .select("google_id")
      .eq("id", userId)
      .limit(1)
      .maybeSingle();

    if (!member?.google_id) return;

    const { data: existing } = await supabase
      .from("notification_history")
      .select("id")
      .eq("target", "user")
      .eq("target_value", String(member.google_id))
      .eq("title", WELCOME_TITLE)
      .limit(1)
      .maybeSingle();

    if (existing) return;
    console.log(`[ONESIGNAL] Sending welcome to user ${userId} (googleSub: ${member.google_id.substring(0, 12)}...)`);
    await sendToUser(member.google_id, { title: WELCOME_TITLE, body: WELCOME_BODY, category: "welcome" });
  } catch (err) {
    console.error("[ONESIGNAL] Welcome error:", err.message);
  }
}

// ─── TASK 1: Fix Device Registration Lifecycle ──────────────────

router.delete("/unregister", auth, async (req, res) => {
  if (supabase) {
    await supabase.from("members").update({ onesignal_id: null }).eq("id", req.user.id);
    await supabase.from("notification_devices").delete().eq("member_id", req.user.id);
  }
  console.log(`[OneSignal] User ${req.user.id} unregistered`);
  res.json({ message: "User unregistered from notifications" });
});

router.post("/save-oneSignal-id", auth, async (req, res) => {
  try {
    if (!supabase) {
      console.error("[ONESIGNAL] save-oneSignal-id: Supabase client not configured");
      return res.status(503).json({ message: "Database not available" });
    }

    const {
      onesignalId, onesignalUserId,
      browser, platform: devicePlatform, language, timezone, userAgent, lastSeen,
    } = req.body;

    if (!onesignalId) return res.status(400).json({ message: "onesignalId is required" });

    const updateData = { onesignal_id: String(onesignalId) };

    if (onesignalUserId) updateData.onesignal_user_id = String(onesignalUserId);
    if (browser) updateData.push_browser = browser;
    if (devicePlatform) updateData.push_platform = devicePlatform;
    if (language) updateData.push_language = language;
    if (timezone) updateData.push_timezone = timezone;
    updateData.push_last_seen = lastSeen || new Date().toISOString();
    if (userAgent) updateData.push_user_agent = userAgent;

    const { error } = await supabase
      .from("members")
      .update(updateData)
      .eq("id", req.user.id);

    if (error) {
      console.error("[ONESIGNAL] Save ID error:", error.message);
      return res.status(500).json({ message: "Failed to save OneSignal ID" });
    }

    try {
      const { data: member } = await supabase
        .from("members")
        .select("google_id")
        .eq("id", req.user.id)
        .limit(1)
        .maybeSingle();

      await supabase
        .from("notification_devices")
        .upsert(
          {
            member_id: req.user.id,
            onesignal_subscription_id: String(onesignalId),
            onesignal_user_id: onesignalUserId ? String(onesignalUserId) : null,
            browser: browser || null,
            platform: devicePlatform || null,
            language: language || null,
            timezone: timezone || null,
            user_agent: userAgent || null,
            last_seen: lastSeen || new Date().toISOString(),
            google_id: member?.google_id || null,
          },
          { onConflict: "member_id,onesignal_subscription_id" }
        );
    } catch (deviceErr) {
      console.error("[ONESIGNAL] Device upsert warning:", deviceErr.message);
    }

    console.log(`[ONESIGNAL] Saved ID for user ${req.user.id}: ${onesignalId}`);
    res.json({ message: "OneSignal ID saved" });
  } catch (err) {
    console.error("[ONESIGNAL] Save ID exception:", err.message);
    res.status(500).json({ message: "Failed to save OneSignal ID" });
  }
});

// ─── SEND NOTIFICATION ──────────────────────────────────────────
// Flow: resolve members → create inbox records (ALWAYS) → attempt push (separate) → return stats

router.post("/send", requireLeaderOrAdmin, async (req, res) => {
  try {
    if (!supabase) {
      console.error("[NOTIFICATIONS] send: Supabase client not configured");
      return res.status(503).json({ message: "Database not available" });
    }

    const {
      title, body, subtitle, image, largeIcon, deepLink,
      priority, ttl, buttons, target, targetValue, schedule,
      importance, channel, silent, category,
    } = req.body;

    if (!title || !body) return res.status(400).json({ message: "title and body are required" });

    const effectivePriority = importance || priority || "default";
    if (effectivePriority === "urgent" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can send urgent priority notifications" });
    }

    console.log(`[NOTIFICATIONS] SEND REQUEST | sender=${req.user.id} role=${req.user.role} target="${target}" value="${targetValue}" title="${title.slice(0, 40)}"`);

    // ── STEP 1: Resolve target members for inbox records ──
    const { memberIds, error: resolveError } = await resolveTargetMembers(target, targetValue);
    if (resolveError) {
      console.error(`[NOTIFICATIONS] Member resolution failed: ${resolveError}`);
      return res.status(400).json({ message: "Failed to resolve target audience", error: resolveError });
    }

    // ── STEP 2: Record notification_history ──
    const historyId = await recordHistory({
      title, body, target, targetValue,
      sentBy: req.user.id, sentCount: memberIds.length,
      importance: effectivePriority, channel, category,
    });
    console.log(`[NOTIFICATIONS] History recorded | id=${historyId} | audience=${memberIds.length} members`);

    // ── STEP 3: Create inbox records for ALL targeted members (ALWAYS, never skipped) ──
    let inboxCount = 0;
    if (memberIds.length > 0) {
      const inboxResult = await createInboxRecords(memberIds, {
        title, body, category, deepLink, image,
        notificationHistoryId: historyId,
      });
      inboxCount = inboxResult.created;
      if (inboxResult.error) {
        console.error(`[NOTIFICATIONS] Inbox creation partial failure: ${inboxResult.error} (${inboxCount}/${memberIds.length} created)`);
      } else {
        console.log(`[NOTIFICATIONS] Inbox records created | count=${inboxCount}`);
      }
    } else {
      console.log(`[NOTIFICATIONS] No members to create inbox records for`);
    }

    // ── STEP 4: Attempt remote push delivery (separate, never blocks inbox) ──
    let pushResult = { sent: 0, error: null, onesignalId: null };
    try {
      const options = {
        title, body, subtitle, image, largeIcon, deepLink,
        priority: effectivePriority, ttl, buttons,
        schedule, silent, category, importance, channel,
      };
      pushResult = await sendPushViaOneSignal(target, targetValue, options);
    } catch (pushErr) {
      console.error(`[NOTIFICATIONS] Push delivery exception: ${pushErr.message}`);
      pushResult = { sent: 0, error: pushErr.message, onesignalId: null };
    }

    // ── STEP 5: Update history with push stats ──
    if (historyId && pushResult.onesignalId) {
      try {
        await supabase
          .from("notification_history")
          .update({
            sent_count: pushResult.sent,
            delivered_count: pushResult.sent,
            onesignal_id: pushResult.onesignalId,
            error: pushResult.error || null,
            status: pushResult.error ? "partial" : "sent",
          })
          .eq("id", historyId);
      } catch (updateErr) {
        console.error(`[NOTIFICATIONS] History update error: ${updateErr.message}`);
      }
    }

    console.log(`[NOTIFICATIONS] SEND COMPLETE | inbox=${inboxCount} push=${pushResult.sent} pushError=${pushResult.error || "none"}`);

    // ── STEP 6: Return combined stats ──
    const responseMessage = pushResult.error
      ? (inboxCount > 0 ? `Notification saved to ${inboxCount} inbox(es). Push delivery had issues.` : "Notification saved. Push delivery had issues.")
      : (pushResult.sent > 0 ? `Notification sent to ${pushResult.sent} device(s)` : "Notification saved to inbox");

    res.json({
      message: responseMessage,
      inboxRecords: inboxCount,
      sent: pushResult.sent,
      errors: pushResult.error ? 1 : 0,
      error: pushResult.error || null,
      onesignalId: pushResult.onesignalId || null,
      audienceCount: memberIds.length,
    });
  } catch (err) {
    console.error(`[NOTIFICATIONS] Send error: ${err.message}`);
    console.error(`[NOTIFICATIONS] Send error stack: ${err.stack}`);
    const isDev = process.env.NODE_ENV !== "production";
    res.status(500).json({
      message: "Failed to send notification",
      error: err.message,
      ...(isDev && { stack: err.stack }),
    });
  }
});

// ─── TASK 3: Audience Count Preview Endpoint ───────────────────

router.post("/audience-count", auth, async (req, res) => {
  try {
    const { target, targetValue } = req.body;
    const count = await getSubscribedCount(target || "all", targetValue);
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: "Failed to count audience", error: err.message });
  }
});

// ─── TASK 2: Device Management Stats ──────────────────────────

router.get("/devices/stats", requireAdmin, async (_req, res) => {
  try {
    const { data: members, error: membersError } = await supabase
      .from("members")
      .select("id, google_id, push_platform, push_browser, push_last_seen, enabled");

    if (membersError) return res.status(500).json({ message: "Failed to fetch device stats" });

    const totalMembers = members?.length || 0;
    const enabledMembers = members?.filter((m) => m.enabled === 1) || members || [];

    const linkedCount = enabledMembers.filter((m) => m.google_id).length;
    const missingCount = enabledMembers.length - linkedCount;

    const platformDist = {};
    const browserDist = {};
    enabledMembers.forEach((m) => {
      if (m.push_platform) {
        platformDist[m.push_platform] = (platformDist[m.push_platform] || 0) + 1;
      }
      if (m.push_browser) {
        browserDist[m.push_browser] = (browserDist[m.push_browser] || 0) + 1;
      }
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const inactiveDevices = enabledMembers.filter((m) => {
      if (!m.google_id) return false;
      if (!m.push_last_seen) return true;
      return new Date(m.push_last_seen) < thirtyDaysAgo;
    }).length;

    const { count: deviceCount } = await supabase
      .from("notification_devices")
      .select("id", { count: "exact", head: true });

    const { data: multiDeviceUsers } = await supabase
      .from("notification_devices")
      .select("member_id")
      .group("member_id")
      .having("count(*)", "gt", 1);

    res.json({
      totalMembers,
      linkedCount,
      missingCount,
      inactiveDevices,
      totalDevices: deviceCount || 0,
      multiDeviceUsers: multiDeviceUsers?.length || 0,
      platformDistribution: platformDist,
      browserDistribution: browserDist,
      thirtyDayThreshold: thirtyDaysAgo.toISOString(),
    });
  } catch (err) {
    console.error("[OneSignal] Device stats error:", err.message);
    res.status(500).json({ message: "Failed to fetch device stats" });
  }
});

// ─── Admin: All Member Devices ───────────────────────────────

router.get("/devices/all", requireAdmin, async (_req, res) => {
  if (!supabase) return res.json({ devices: [] });
  try {
    const { data: devices, error } = await supabase
      .from("notification_devices")
      .select("id, member_id, onesignal_subscription_id, onesignal_user_id, browser, platform, language, timezone, user_agent, last_seen, active, google_id, created_at, updated_at")
      .order("last_seen", { ascending: false });
    if (error) {
      console.error("[ONESIGNAL] Admin devices list error:", error.message);
      return res.json({ devices: [] });
    }
    res.json({ devices: devices || [] });
  } catch (err) {
    console.error("[ONESIGNAL] Admin devices list error:", err.message);
    res.json({ devices: [] });
  }
});

router.delete("/devices/admin/:deviceId", requireAdmin, async (req, res) => {
  if (!supabase) return res.status(500).json({ message: "Database not available" });
  try {
    const { error } = await supabase
      .from("notification_devices")
      .delete()
      .eq("id", req.params.deviceId);
    if (error) {
      console.error("[OneSignal] Admin device delete error:", error.message);
      return res.status(500).json({ message: "Failed to remove device" });
    }
    res.json({ message: "Device removed" });
  } catch (err) {
    console.error("[OneSignal] Admin device delete error:", err.message);
    res.status(500).json({ message: "Failed to remove device" });
  }
});

// ─── User Device Management ──────────────────────────────────

router.get("/devices", auth, async (req, res) => {
  if (!supabase) return res.json({ devices: [] });
  try {
    const { data: devices, error } = await supabase
      .from("notification_devices")
      .select("id, onesignal_subscription_id, onesignal_user_id, browser, platform, language, timezone, last_seen, active, google_id, created_at, updated_at")
      .eq("member_id", req.user.id)
      .order("last_seen", { ascending: false });
    if (error) {
      console.error("[ONESIGNAL] Devices list error:", error.message);
      return res.json({ devices: [] });
    }
    res.json({ devices: devices || [] });
  } catch (err) {
    console.error("[ONESIGNAL] Devices list error:", err.message);
    res.json({ devices: [] });
  }
});

router.delete("/devices/:deviceId", auth, async (req, res) => {
  if (!supabase) return res.status(500).json({ message: "Database not available" });
  try {
    const { error } = await supabase
      .from("notification_devices")
      .delete()
      .eq("id", req.params.deviceId)
      .eq("member_id", req.user.id);
    if (error) {
      console.error("[OneSignal] Device delete error:", error.message);
      return res.status(500).json({ message: "Failed to remove device" });
    }
    res.json({ message: "Device removed" });
  } catch (err) {
    console.error("[OneSignal] Device delete error:", err.message);
    res.status(500).json({ message: "Failed to remove device" });
  }
});

// ─── Existing endpoints (improved) ────────────────────────────

router.post("/retry/:onesignalId", requireAdmin, async (req, res) => {
  try {
    const config = getConfig();
    if (!config.configured) {
      return res.status(500).json({ message: "OneSignal not configured" });
    }

    const { onesignalId } = req.params;
    if (!onesignalId) return res.status(400).json({ message: "onesignalId required" });

    const resp = await fetch(`https://api.onesignal.com/notifications/${onesignalId}?app_id=${ONESIGNAL_APP_ID}`, {
      method: "GET",
      headers: {
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      return res.status(resp.status).json({ message: "Failed to fetch notification from OneSignal" });
    }

    const data = await resp.json();
    res.json({
      id: data.id,
      recipients: data.recipients,
      completed_at: data.completed_at,
      platform_stats: data.platform_stats || {},
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to check notification status", error: err.message });
  }
});

// ─── TASK 4: Enhanced History ─────────────────────────────────

router.get("/history", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const categoryFilter = req.query.category || null;

    let query = supabase
      .from("notification_history")
      .select("*, members!sent_by(name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (categoryFilter) {
      query = query.eq("category", categoryFilter);
    }

    const { data, error, count } = await query;

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
    console.log(`[OneSignal] Admin cleared ${count || 0} history records`);
    res.json({ success: true, deleted: count || 0 });
  } catch (err) {
    console.error("[OneSignal] Clear history error:", err.message);
    res.status(500).json({ success: false, message: "Failed to clear history", error: err.message });
  }
});

// ─── TASK 9: Enhanced Stats ───────────────────────────────────

router.get("/stats", requireAdmin, async (_req, res) => {
  try {
    const { data: members, error: membersError } = await supabase
      .from("members").select("id, google_id, push_platform, push_browser, push_last_seen, enabled");

    if (membersError) return res.status(500).json({ message: "Failed to fetch stats" });

    const totalMembers = members?.length || 0;
    const enabledMembers = members?.filter((m) => m.enabled === 1) || members || [];
    const membersWithGoogle = enabledMembers.filter((m) => m.google_id).length;
    const membersWithoutGoogle = enabledMembers.length - membersWithGoogle;

    const platforms = {};
    const browsers = {};
    enabledMembers.forEach((m) => {
      if (m.push_platform) {
        platforms[m.push_platform] = (platforms[m.push_platform] || 0) + 1;
      }
      if (m.push_browser) {
        browsers[m.push_browser] = (browsers[m.push_browser] || 0) + 1;
      }
    });

    const { count: historyCount } = await supabase
      .from("notification_history").select("id", { count: "exact", head: true });

    const { data: allHistory } = await supabase
      .from("notification_history")
      .select("sent_count, delivered_count, opened_count, clicked_count, failed_count, error, category, status")
      .order("created_at", { ascending: false })
      .limit(500);

    const totalSent = (allHistory || []).reduce((s, h) => s + (h.sent_count || 0), 0);
    const totalDelivered = (allHistory || []).reduce((s, h) => s + (h.delivered_count || 0), 0);
    const totalOpened = (allHistory || []).reduce((s, h) => s + (h.opened_count || 0), 0);
    const totalClicked = (allHistory || []).reduce((s, h) => s + (h.clicked_count || 0), 0);
    const totalFailed = (allHistory || []).reduce((s, h) => s + (h.failed_count || 0), 0);
    const failedNotifications = (allHistory || []).filter((h) => h.error).length;

    // Category breakdown
    const categoryStats = {};
    (allHistory || []).forEach((h) => {
      const cat = h.category || "general";
      if (!categoryStats[cat]) categoryStats[cat] = { sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, count: 0 };
      categoryStats[cat].sent += h.sent_count || 0;
      categoryStats[cat].delivered += h.delivered_count || 0;
      categoryStats[cat].opened += h.opened_count || 0;
      categoryStats[cat].clicked += h.clicked_count || 0;
      categoryStats[cat].failed += h.failed_count || 0;
      categoryStats[cat].count += 1;
    });

    // Status breakdown
    const statusCounts = {};
    (allHistory || []).forEach((h) => {
      const st = h.status || "sent";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });

    res.json({
      totalMembers,
      membersWithGoogle,
      membersWithoutGoogle,
      totalNotificationsSent: historyCount || 0,
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalFailed,
      failedNotifications,
      deliveryRate: totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : "0",
      openRate: totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100).toFixed(1) : "0",
      clickRate: totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : "0",
      platforms,
      browsers,
      categoryStats,
      statusCounts,
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch stats" });
  }
});

// ─── TASK 5: User Notification Inbox ──────────────────────────

function logSupabaseError(context, error) {
  console.error(`[OneSignal] ${context}:`, JSON.stringify({
    message: error?.message || "unknown",
    code: error?.code || "unknown",
    details: error?.details || null,
    hint: error?.hint || null,
  }));
}

router.get("/inbox", auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: "Invalid token payload", details: "User ID missing from JWT" });
    }

    if (!supabase) {
      return res.status(500).json({ success: false, error: "Supabase not configured", details: "Missing SUPABASE_URL or SUPABASE_SECRET_KEY" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unread === "true";
    const categoryFilter = req.query.category || null;
    const memberId = Number(req.user.id);

    if (isNaN(memberId) || memberId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid user ID", details: `Got: ${req.user.id}` });
    }

    let query = supabase
      .from("user_notifications")
      .select("*", { count: "exact" })
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) query = query.eq("read", false);
    if (categoryFilter) query = query.eq("category", categoryFilter);

    const { data, error, count } = await query;

    if (error) {
      logSupabaseError("Inbox query failed", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch notifications",
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
      });
    }

    let unreadCount = 0;
    const unreadResult = await supabase
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .eq("read", false);

    if (unreadResult.error) {
      logSupabaseError("Unread count query failed", unreadResult.error);
    } else {
      unreadCount = unreadResult.count || 0;
    }

    res.json({
      success: true,
      data: data || [],
      total: count || 0,
      unreadCount,
      page,
      limit,
    });
  } catch (err) {
    console.error("[OneSignal] Inbox exception:", err.message, err.stack);
    res.status(500).json({
      success: false,
      error: err.message || "Internal server error",
      details: "Unhandled exception in inbox endpoint",
    });
  }
});

router.put("/inbox/read-all", auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: "Invalid token payload" });
    }
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Supabase not configured" });
    }

    const memberId = Number(req.user.id);
    const { error } = await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("member_id", memberId)
      .eq("read", false);

    if (error) {
      logSupabaseError("Mark all read failed", error);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
      });
    }
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("[OneSignal] Mark-all-read exception:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/inbox/:id/read", auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: "Invalid token payload" });
    }
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Supabase not configured" });
    }

    const notifId = parseInt(req.params.id);
    if (isNaN(notifId) || notifId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid notification ID" });
    }

    const { error } = await supabase
      .from("user_notifications")
      .update({ read: true })
      .eq("id", notifId)
      .eq("member_id", Number(req.user.id));

    if (error) {
      logSupabaseError("Mark single read failed", error);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
      });
    }
    res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error("[OneSignal] Mark-read exception:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/inbox/:id", auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: "Invalid token payload" });
    }
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Supabase not configured" });
    }

    const notifId = parseInt(req.params.id);
    if (isNaN(notifId) || notifId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid notification ID" });
    }

    const { error } = await supabase
      .from("user_notifications")
      .delete()
      .eq("id", notifId)
      .eq("member_id", Number(req.user.id));

    if (error) {
      logSupabaseError("Delete notification failed", error);
      return res.status(500).json({
        success: false,
        error: error.message,
        details: error.details || null,
        hint: error.hint || null,
        code: error.code || null,
      });
    }
    res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    console.error("[OneSignal] Delete notification exception:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Diagnostics ──────────────────────────────────────────────

router.get("/diagnostics", auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: "Invalid token payload" });
    }
    if (!supabase) {
      return res.status(500).json({ success: false, error: "Supabase not configured" });
    }

    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, google_id, google_email, google_name, google_verified, google_linked, google_linked_at, onesignal_id, onesignal_user_id, push_browser, push_platform, push_language, push_timezone, push_last_seen")
      .eq("id", req.user.id)
      .single();

    if (memberError) {
      console.error("[ONESIGNAL] Diagnostics member query failed:", memberError.message);
    }

    const { data: devices, error: devicesError } = await supabase
      .from("notification_devices")
      .select("id, onesignal_subscription_id, onesignal_user_id, browser, platform, language, timezone, user_agent, last_seen, active, google_id, created_at, updated_at")
      .eq("member_id", req.user.id)
      .order("last_seen", { ascending: false });

    if (devicesError) {
      console.error("[ONESIGNAL] Diagnostics devices query failed:", devicesError.message);
    }

    res.json({
      success: true,
      backend: getConfig(),
      user: member ? {
        id: member.id,
        googleId: member.google_id,
        googleEmail: member.google_email,
        googleName: member.google_name,
        googleVerified: member.google_verified,
        googleLinked: member.google_linked,
        googleLinkedAt: member.google_linked_at,
        onesignalId: member.onesignal_id,
        onesignalUserId: member.onesignal_user_id,
        browser: member.push_browser,
        platform: member.push_platform,
        language: member.push_language,
        timezone: member.push_timezone,
        lastSeen: member.push_last_seen,
      } : null,
      devices: devices || [],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[ONESIGNAL] Diagnostics exception:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/config-status", requireAdmin, (_req, res) => res.json(getConfig()));

export default router;

import { supabase } from "../config/supabase.js";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || "";
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || "";
const ONESIGNAL_API_URL = "https://api.onesignal.com/notifications";
const REQUEST_TIMEOUT_MS = 30000;

function getConfig() {
  return {
    configured: !!(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY),
    appId: ONESIGNAL_APP_ID ? ONESIGNAL_APP_ID.substring(0, 8) + "..." : "MISSING",
    apiKey: ONESIGNAL_REST_API_KEY ? "set (length=" + ONESIGNAL_REST_API_KEY.length + ")" : "MISSING",
  };
}

async function sendNotification(payload) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    console.error("[ONESIGNAL] Not configured:", JSON.stringify(getConfig()));
    throw new Error("OneSignal not configured: missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY");
  }

  const body = { ...payload, app_id: ONESIGNAL_APP_ID };

  console.log("[ONESIGNAL] Sending | segments:", body.included_segments || "none", "| aliases:", body.include_aliases ? JSON.stringify(body.include_aliases).slice(0, 100) : "none", "| filters:", body.filters ? JSON.stringify(body.filters).slice(0, 100) : "none", "| priority:", body.priority, "| send_after:", body.send_after || "immediate");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const result = await response.json();

    console.log("[ONESIGNAL] Raw response:", JSON.stringify(result).slice(0, 500));

    if (!response.ok) {
      const errMsg = result.errors?.[0] || result.message || result.error || `OneSignal API error ${response.status}`;
      console.error("[ONESIGNAL] API error:", response.status, "|", errMsg);
      throw new Error(errMsg);
    }

    const recipients = result.recipients || 0;
    console.log("[ONESIGNAL] Sent OK | id:", result.id, "| recipients:", recipients);
    return result;
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("[ONESIGNAL] Request timed out after", REQUEST_TIMEOUT_MS, "ms");
      throw new Error("OneSignal API request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function buildPayload(options) {
  const {
    title, body: msgBody, image, deepLink, subtitle, largeIcon,
    buttons, priority, ttl, data, schedule, silent, category,
  } = options;

  const payload = {
    contents: { en: msgBody || "" },
    headings: { en: title || "MT Club" },
  };

  if (subtitle) payload.subtitle = { en: subtitle };
  if (image) payload.big_picture = image;
  if (largeIcon) payload.large_icon = largeIcon;
  if (category) payload.category = category;

  if (ttl !== undefined && ttl !== null && ttl !== "") {
    payload.ttl = parseInt(ttl, 10);
  }

  if (priority !== undefined && priority !== null) {
    const priorityMap = { silent: 0, default: 5, high: 8, urgent: 10 };
    payload.priority = priorityMap[priority] ?? 5;
  }

  if (silent === true || priority === "silent") {
    payload.content_available = true;
    payload.priority = 0;
  }

  if (buttons && Array.isArray(buttons) && buttons.length > 0) {
    payload.buttons = buttons.map((b, i) => ({
      id: b.id || String(i + 1),
      text: b.text || "",
      icon: b.icon || undefined,
    }));
  }

  if (deepLink) {
    payload.data = {
      ...(data && typeof data === "object" ? data : {}),
      deepLink,
      screen: deepLink,
    };
  } else if (data && typeof data === "object") {
    payload.data = data;
  }

  if (schedule) {
    try {
      const sendAfter = new Date(schedule).toISOString();
      if (!isNaN(new Date(sendAfter).getTime())) {
        payload.send_after = sendAfter;
      }
    } catch (e) {
      console.warn("[ONESIGNAL] Invalid schedule value:", schedule, "| error:", e.message);
    }
  }

  return payload;
}

async function recordHistory({
  title, body: msgBody, target, targetValue, sentBy,
  sentCount, onesignalId, error, importance, channel, category,
  deliveredCount, failedCount, status,
}) {
  if (!supabase) return null;
  try {
    const { data, error: insertError } = await supabase.from("notification_history").insert({
      title,
      body: msgBody,
      target,
      target_value: targetValue || null,
      sent_by: sentBy || null,
      sent_count: sentCount || 0,
      delivered_count: deliveredCount || sentCount || 0,
      failed_count: failedCount || 0,
      onesignal_id: onesignalId || null,
      error: error || null,
      importance: importance || "default",
      channel: channel || "general",
      category: category || "general",
      status: error ? "failed" : (status || "sent"),
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    if (insertError) console.error("[ONESIGNAL] History insert error:", insertError.message);
    return data?.[0]?.id || null;
  } catch (err) {
    console.error("[ONESIGNAL] History exception:", err.message);
    return null;
  }
}

async function resolveGoogleIds(memberIds) {
  if (!supabase || !memberIds?.length) return [];
  const { data, error } = await supabase
    .from("members")
    .select("id, google_id")
    .in("id", memberIds)
    .eq("enabled", 1)
    .not("google_id", "is", null);
  if (error) {
    console.error("[ONESIGNAL] resolveGoogleIds error:", error.message);
    return [];
  }
  return data || [];
}

async function getGoogleIdForMember(memberId) {
  if (!supabase || !memberId) return null;
  const { data } = await supabase
    .from("members")
    .select("google_id")
    .eq("id", memberId)
    .eq("enabled", 1)
    .not("google_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.google_id || null;
}

export async function getSubscribedCount(target, targetValue) {
  if (!supabase) return 0;
  try {
    switch (target) {
      case "all": {
        const { count } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("enabled", 1)
          .not("google_id", "is", null);
        return count || 0;
      }
      case "user": {
        if (!targetValue) return 0;
        const { data } = await supabase
          .from("members")
          .select("google_id")
          .eq("id", parseInt(targetValue))
          .single();
        return data?.google_id ? 1 : 0;
      }
      case "multiple_users": {
        if (!targetValue) return 0;
        const ids = targetValue.split(",").map((s) => parseInt(s.trim())).filter(Boolean);
        const { count } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .in("id", ids)
          .not("google_id", "is", null);
        return count || 0;
      }
      case "committee": {
        if (!targetValue) return 0;
        const { count } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("committee", targetValue)
          .eq("enabled", 1)
          .not("google_id", "is", null);
        return count || 0;
      }
      case "role": {
        if (!targetValue) return 0;
        const { count } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("role", targetValue)
          .eq("enabled", 1)
          .not("google_id", "is", null);
        return count || 0;
      }
      case "tag": {
        if (!targetValue) return 0;
        const [tagKey, ...tagValParts] = targetValue.split("=");
        const tagValue = tagValParts.join("=");
        if (!tagKey || !tagValue) return 0;
        const { count } = await supabase
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("enabled", 1)
          .not("google_id", "is", null);
        return count || 0;
      }
      default:
        return -1;
    }
  } catch (err) {
    console.error("[ONESIGNAL] getSubscribedCount error:", err.message);
    return 0;
  }
}

// ─── Resolve target member IDs for INBOX records ─────────────────
// This queries the MEMBERS table, NOT notification_devices.
// Every eligible member gets an inbox record regardless of device registration.

export async function resolveTargetMembers(target, targetValue) {
  if (!supabase) return { memberIds: [], error: "Supabase not configured" };
  try {
    let memberIds = [];

    switch (target) {
      case "all": {
        const { data, error } = await supabase
          .from("members")
          .select("id")
          .eq("enabled", 1)
          .not("google_id", "is", null);
        if (error) throw new Error(`members query failed: ${error.message}`);
        memberIds = (data || []).map((m) => m.id);
        break;
      }
      case "user": {
        if (!targetValue) break;
        const memberId = parseInt(targetValue);
        if (!isNaN(memberId)) memberIds = [memberId];
        break;
      }
      case "multiple_users": {
        if (!targetValue) break;
        memberIds = targetValue.split(",").map((s) => parseInt(s.trim())).filter(Boolean);
        break;
      }
      case "committee": {
        if (!targetValue) break;
        const { data, error } = await supabase
          .from("members")
          .select("id")
          .eq("committee", targetValue)
          .eq("enabled", 1)
          .not("google_id", "is", null);
        if (error) throw new Error(`committee query failed: ${error.message}`);
        memberIds = (data || []).map((m) => m.id);
        break;
      }
      case "role": {
        if (!targetValue) break;
        const { data, error } = await supabase
          .from("members")
          .select("id")
          .eq("role", targetValue)
          .eq("enabled", 1)
          .not("google_id", "is", null);
        if (error) throw new Error(`role query failed: ${error.message}`);
        memberIds = (data || []).map((m) => m.id);
        break;
      }
      case "tag": {
        if (!targetValue) break;
        const [tagKey, ...tagValParts] = targetValue.split("=");
        const tagValue = tagValParts.join("=");
        if (!tagKey || !tagValue) break;
        if (tagKey === "platform") {
          const { data, error } = await supabase
            .from("members")
            .select("id")
            .eq("enabled", 1)
            .not("google_id", "is", null);
          if (error) throw new Error(`members query failed: ${error.message}`);
          memberIds = (data || []).map((m) => m.id);
        } else {
          const { data, error } = await supabase
            .from("members")
            .select("id")
            .eq("enabled", 1)
            .not("google_id", "is", null);
          if (error) throw new Error(`members query failed: ${error.message}`);
          memberIds = (data || []).map((m) => m.id);
        }
        break;
      }
      default:
        break;
    }

    memberIds = [...new Set(memberIds)];
    if (memberIds.length > 5000) memberIds = memberIds.slice(0, 5000);

    console.log(`[NOTIFICATIONS] Resolved ${memberIds.length} members for target="${target}" value="${targetValue}"`);
    return { memberIds, error: null };
  } catch (err) {
    console.error(`[NOTIFICATIONS] resolveTargetMembers error: ${err.message}`);
    return { memberIds: [], error: err.message };
  }
}

// ─── Create inbox records INDEPENDENTLY of push delivery ──────────

export async function createInboxRecords(memberIds, { title, body, category, deepLink, image, notificationHistoryId }) {
  if (!supabase || !memberIds?.length) return { created: 0, error: null };
  try {
    const records = memberIds.map((memberId) => ({
      member_id: memberId,
      notification_history_id: notificationHistoryId,
      title,
      body,
      category: category || "general",
      deep_link: deepLink || null,
      image_url: image || null,
      read: false,
      created_at: new Date().toISOString(),
    }));

    let created = 0;
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase.from("user_notifications").insert(batch);
      if (error) {
        console.error(`[NOTIFICATIONS] user_notifications insert error: ${error.message}`);
        return { created, error: error.message };
      }
      created += batch.length;
    }

    console.log(`[NOTIFICATIONS] Created ${created} inbox records (historyId=${notificationHistoryId})`);
    return { created, error: null };
  } catch (err) {
    console.error(`[NOTIFICATIONS] createInboxRecords error: ${err.message}`);
    return { created: 0, error: err.message };
  }
}

// ─── Send push via OneSignal INDEPENDENTLY ───────────────────────
// Returns { sent, error, onesignalId }. Does NOT record history.

export async function sendPushViaOneSignal(target, targetValue, options) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    const msg = "OneSignal not configured: missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY";
    console.error(`[NOTIFICATIONS] ${msg}`);
    return { sent: 0, error: msg, onesignalId: null };
  }

  try {
    const payload = buildPayload(options);
    payload.target_channel = "push";

    switch (target) {
      case "all":
        payload.included_segments = ["Subscribed Users"];
        break;

      case "user": {
        if (!targetValue) return { sent: 0, error: "targetValue required", onesignalId: null };
        const googleSub = await getGoogleIdForMember(parseInt(targetValue));
        if (!googleSub) return { sent: 0, error: "Target user has no linked Google account", onesignalId: null };
        payload.include_aliases = { external_id: [String(googleSub)] };
        break;
      }

      case "multiple_users": {
        if (!targetValue) return { sent: 0, error: "targetValue required", onesignalId: null };
        const ids = targetValue.split(",").map((s) => parseInt(s.trim())).filter(Boolean);
        if (!ids.length) return { sent: 0, error: "No valid user IDs", onesignalId: null };
        const { data: members } = await supabase
          .from("members").select("google_id")
          .in("id", ids).not("google_id", "is", null);
        const subs = (members || []).map((m) => m.google_id).filter(Boolean);
        if (!subs.length) return { sent: 0, error: "No target users have linked Google accounts", onesignalId: null };
        payload.include_aliases = { external_id: subs.map(String) };
        break;
      }

      case "committee": {
        if (!targetValue) return { sent: 0, error: "targetValue required", onesignalId: null };
        const { data: members } = await supabase
          .from("members").select("google_id")
          .eq("committee", targetValue).eq("enabled", 1).not("google_id", "is", null);
        const subs = (members || []).map((m) => m.google_id).filter(Boolean);
        if (!subs.length) return { sent: 0, error: "No eligible members in committee", onesignalId: null };
        payload.include_aliases = { external_id: subs.map(String) };
        break;
      }

      case "role": {
        if (!targetValue) return { sent: 0, error: "targetValue required", onesignalId: null };
        const { data: members } = await supabase
          .from("members").select("google_id")
          .eq("role", targetValue).eq("enabled", 1).not("google_id", "is", null);
        const subs = (members || []).map((m) => m.google_id).filter(Boolean);
        if (!subs.length) return { sent: 0, error: "No eligible members with this role", onesignalId: null };
        payload.include_aliases = { external_id: subs.map(String) };
        break;
      }

      case "tag": {
        if (!targetValue) return { sent: 0, error: "targetValue required", onesignalId: null };
        const [tagKey, ...tagValParts] = targetValue.split("=");
        const tagValue = tagValParts.join("=");
        if (!tagKey || !tagValue) return { sent: 0, error: "targetValue must be key=value format", onesignalId: null };
        payload.filters = [{ field: "tag", key: tagKey, relation: "=", value: tagValue }];
        break;
      }

      case "external_id": {
        if (!targetValue) return { sent: 0, error: "targetValue required", onesignalId: null };
        const extIds = targetValue.split(",").map((s) => s.trim()).filter(Boolean);
        if (!extIds.length) return { sent: 0, error: "No valid external IDs", onesignalId: null };
        payload.include_aliases = { external_id: extIds.map(String) };
        break;
      }

      case "segment": {
        if (!targetValue) return { sent: 0, error: "targetValue required", onesignalId: null };
        payload.included_segments = [targetValue];
        break;
      }

      default:
        payload.included_segments = ["Subscribed Users"];
    }

    console.log(`[NOTIFICATIONS] Push send started | target="${target}" value="${targetValue}" | filters:`, JSON.stringify(payload.filters || payload.included_segments || payload.include_aliases).slice(0, 200));
    const result = await sendNotification(payload);
    const sent = result.recipients || 0;
    console.log(`[NOTIFICATIONS] Push send OK | onesignalId=${result.id} | recipients=${sent}`);
    return { sent, error: null, onesignalId: result.id };
  } catch (err) {
    console.error(`[NOTIFICATIONS] Push send FAILED: ${err.message}`);
    return { sent: 0, error: err.message, onesignalId: null };
  }
}

// ─── Legacy: buildUserNotificationRecords (kept for backward compat) ──

export async function buildUserNotificationRecords({ title, body, category, deepLink, image, target, targetValue, sentBy, notificationHistoryId }) {
  const { memberIds } = await resolveTargetMembers(target, targetValue);
  if (!memberIds.length) return;
  await createInboxRecords(memberIds, { title, body, category, deepLink, image, notificationHistoryId });
}

export async function sendToAll(options, sentBy) {
  try {
    const payload = buildPayload(options);
    payload.included_segments = ["Subscribed Users"];
    payload.target_channel = "push";

    const result = await sendNotification(payload);
    const recipients = result.recipients || 0;
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "all",
      sentBy, sentCount: recipients, onesignalId: result.id,
      importance: options.importance, channel: options.channel, category: options.category,
    });
    return { sent: recipients, failed: 0, error: null, onesignalId: result.id, historyId };
  } catch (err) {
    console.error("[ONESIGNAL] Broadcast failed:", err.message);
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "all",
      sentBy, sentCount: 0, error: err.message,
      importance: options.importance, channel: options.channel, category: options.category,
      status: "failed",
    });
    return { sent: 0, failed: 1, error: err.message, historyId };
  }
}

export async function sendToUser(googleSub, options) {
  if (!googleSub) {
    console.error("[ONESIGNAL] sendToUser called without googleSub — skipping");
    return { sent: 0, failed: 0, error: "No googleSub provided" };
  }

  try {
    const payload = buildPayload(options);
    payload.include_aliases = { external_id: [String(googleSub)] };
    payload.target_channel = "push";

    const result = await sendNotification(payload);
    const recipients = result.recipients || 0;
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "user",
      targetValue: String(googleSub), sentBy: null, sentCount: recipients,
      onesignalId: result.id, importance: options.importance, channel: options.channel,
      category: options.category,
    });
    return { sent: recipients, failed: 0, error: null, onesignalId: result.id, historyId };
  } catch (err) {
    console.error("[ONESIGNAL] Send to user", googleSub?.substring?.(0, 12) || "???", "failed:", err.message);
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "user",
      targetValue: String(googleSub), sentBy: null, sentCount: 0,
      error: err.message, importance: options.importance, channel: options.channel,
      category: options.category, status: "failed",
    });
    return { sent: 0, failed: 1, error: err.message, historyId };
  }
}

export async function sendToUsers(googleSubs, options) {
  if (!googleSubs?.length) {
    return { sent: 0, failed: 0, error: null };
  }

  try {
    const payload = buildPayload(options);
    payload.include_aliases = { external_id: googleSubs.map(String) };
    payload.target_channel = "push";

    const result = await sendNotification(payload);
    const recipients = result.recipients || 0;
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "multiple_users",
      targetValue: googleSubs.join(","), sentBy: null, sentCount: recipients,
      onesignalId: result.id, importance: options.importance, channel: options.channel,
      category: options.category,
    });
    return { sent: recipients, failed: 0, error: null, onesignalId: result.id, historyId };
  } catch (err) {
    console.error("[ONESIGNAL] Send to multiple users failed:", err.message);
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "multiple_users",
      targetValue: googleSubs.join(","), sentBy: null, sentCount: 0,
      error: err.message, importance: options.importance, channel: options.channel,
      category: options.category, status: "failed",
    });
    return { sent: 0, failed: 1, error: err.message, historyId };
  }
}

export async function sendToSegment(segmentName, options) {
  try {
    const payload = buildPayload(options);
    payload.included_segments = [segmentName];
    payload.target_channel = "push";

    const result = await sendNotification(payload);
    const recipients = result.recipients || 0;
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "segment",
      targetValue: segmentName, sentBy: null, sentCount: recipients,
      onesignalId: result.id, importance: options.importance, channel: options.channel,
      category: options.category,
    });
    return { sent: recipients, failed: 0, error: null, onesignalId: result.id, historyId };
  } catch (err) {
    console.error("[ONESIGNAL] Send to segment", segmentName, "failed:", err.message);
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "segment",
      targetValue: segmentName, sentBy: null, sentCount: 0,
      error: err.message, importance: options.importance, channel: options.channel,
      category: options.category, status: "failed",
    });
    return { sent: 0, failed: 1, error: err.message, historyId };
  }
}

export async function sendToCommittee(committeeId, options) {
  if (!supabase) return { sent: 0, failed: 1, error: "Supabase not configured" };

  try {
    const { data: members, error } = await supabase
      .from("members")
      .select("google_id")
      .eq("committee", committeeId)
      .eq("enabled", 1)
      .not("google_id", "is", null);

    if (error) {
      console.error("[ONESIGNAL] Committee query error:", error.message);
      return { sent: 0, failed: 1, error: error.message };
    }

    if (!members || members.length === 0) {
      console.log("[ONESIGNAL] No members with linked Google in committee:", committeeId);
      return { sent: 0, failed: 0, error: null };
    }

    const googleSubs = members.map((m) => m.google_id);
    console.log("[ONESIGNAL] Committee", committeeId, ":", googleSubs.length, "members with linked Google");
    return await sendToUsers(googleSubs, options);
  } catch (err) {
    console.error("[ONESIGNAL] sendToCommittee exception:", err.message);
    return { sent: 0, failed: 1, error: err.message };
  }
}

export async function sendToRole(role, options) {
  if (!supabase) return { sent: 0, failed: 1, error: "Supabase not configured" };

  try {
    const { data: members, error } = await supabase
      .from("members")
      .select("google_id")
      .eq("role", role)
      .eq("enabled", 1)
      .not("google_id", "is", null);

    if (error) {
      console.error("[ONESIGNAL] Role query error:", error.message);
      return { sent: 0, failed: 1, error: error.message };
    }

    if (!members || members.length === 0) {
      return { sent: 0, failed: 0, error: null };
    }

    const googleSubs = members.map((m) => m.google_id);
    return await sendToUsers(googleSubs, options);
  } catch (err) {
    console.error("[ONESIGNAL] sendToRole exception:", err.message);
    return { sent: 0, failed: 1, error: err.message };
  }
}

export async function sendToTag(tagKey, tagValue, options) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    throw new Error("OneSignal not configured");
  }

  try {
    const payload = buildPayload(options);
    payload.filters = [{ field: "tag", key: tagKey, relation: "=", value: tagValue }];
    payload.target_channel = "push";

    const result = await sendNotification(payload);
    const recipients = result.recipients || 0;
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "tag",
      targetValue: `${tagKey}=${tagValue}`, sentBy: null, sentCount: recipients,
      onesignalId: result.id, importance: options.importance, channel: options.channel,
      category: options.category,
    });
    return { sent: recipients, failed: 0, error: null, onesignalId: result.id, historyId };
  } catch (err) {
    console.error("[ONESIGNAL] Send to tag failed:", err.message);
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "tag",
      targetValue: `${tagKey}=${tagValue}`, sentBy: null, sentCount: 0,
      error: err.message, importance: options.importance, channel: options.channel,
      category: options.category, status: "failed",
    });
    return { sent: 0, failed: 1, error: err.message, historyId };
  }
}

export async function sendToExternalIds(externalIds, options) {
  if (!externalIds?.length) return { sent: 0, failed: 0, error: null };

  try {
    const payload = buildPayload(options);
    payload.include_aliases = { external_id: externalIds.map(String) };
    payload.target_channel = "push";

    const result = await sendNotification(payload);
    const recipients = result.recipients || 0;
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "external_id",
      targetValue: externalIds.join(","), sentBy: null, sentCount: recipients,
      onesignalId: result.id, importance: options.importance, channel: options.channel,
      category: options.category,
    });
    return { sent: recipients, failed: 0, error: null, onesignalId: result.id, historyId };
  } catch (err) {
    const historyId = await recordHistory({
      title: options.title, body: options.body, target: "external_id",
      targetValue: externalIds.join(","), sentBy: null, sentCount: 0,
      error: err.message, importance: options.importance, channel: options.channel,
      category: options.category, status: "failed",
    });
    return { sent: 0, failed: 1, error: err.message, historyId };
  }
}

export { getConfig, buildPayload, sendNotification, recordHistory, resolveGoogleIds, getGoogleIdForMember, resolveTargetMembers, createInboxRecords, sendPushViaOneSignal };

import { supabase } from "../config/supabase.js";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || "";
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || "";
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";

function getConfig() {
  return {
    configured: !!(ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY),
    appId: ONESIGNAL_APP_ID ? ONESIGNAL_APP_ID.substring(0, 8) + "..." : "MISSING",
    apiKey: ONESIGNAL_REST_API_KEY ? "set" : "MISSING",
  };
}

async function sendNotification(payload) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    const config = getConfig();
    console.error("[OneSignal] Not configured:", JSON.stringify(config));
    throw new Error("OneSignal not configured: missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY");
  }

  const body = { ...payload, app_id: ONESIGNAL_APP_ID };

  console.log("[OneSignal] Sending notification...");
  console.log("[OneSignal] Payload:", JSON.stringify({
    ...body,
    app_id: ONESIGNAL_APP_ID.substring(0, 8) + "...",
  }));

  const response = await fetch(ONESIGNAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("[OneSignal] API error:", response.status);
    console.error("[OneSignal] Full response:", JSON.stringify(result));
    throw new Error(result.errors?.[0] || result.message || `OneSignal API error ${response.status}`);
  }

  console.log("[OneSignal] Notification sent, id:", result.id, "recipients:", result.recipients);
  return result;
}

function buildPayload(options) {
  const { title, body, image, deepLink, subtitle, largeIcon, buttons, priority, ttl, data, schedule } = options;

  const payload = {
    contents: { en: body || "" },
    headings: { en: title || "MT Club" },
  };

  if (subtitle) payload.subtitle = { en: subtitle };
  if (image) payload.big_picture = image;
  if (largeIcon) payload.large_icon = largeIcon;
  if (ttl !== undefined) payload.ttl = parseInt(ttl);

  if (priority !== undefined) {
    const priorityMap = { silent: 0, default: 5, high: 8, urgent: 10 };
    payload.priority = priorityMap[priority] ?? 5;
  }

  if (buttons && Array.isArray(buttons) && buttons.length > 0) {
    payload.buttons = buttons.map((b, i) => ({
      id: b.id || String(i + 1),
      text: b.text || "",
      icon: b.icon || undefined,
    }));
  }

  if (deepLink) {
    payload.data = { ...(data && typeof data === "object" ? data : {}), deepLink, screen: deepLink };
  } else if (data && typeof data === "object") {
    payload.data = data;
  }

  if (schedule) {
    const sendAfter = new Date(schedule).toISOString();
    if (!isNaN(new Date(sendAfter).getTime())) {
      payload.send_after = sendAfter;
      console.log("[OneSignal] Scheduled for:", sendAfter);
    }
  }

  return payload;
}

export async function sendToAll(options, sentBy) {
  const payload = buildPayload(options);
  payload.included_segments = ["Subscribed Users"];

  try {
    const result = await sendNotification(payload);
    const recipients = result.recipients || 0;

    await recordHistory({
      title: options.title,
      body: options.body,
      target: "all",
      sentBy,
      sentCount: recipients,
      onesignalId: result.id,
    });

    console.log("[OneSignal] Broadcast complete — recipients:", recipients);
    return { sent: recipients, failed: 0, error: null, onesignalId: result.id };
  } catch (err) {
    console.error("[OneSignal] Broadcast failed:", err.message);
    await recordHistory({
      title: options.title,
      body: options.body,
      target: "all",
      sentBy,
      sentCount: 0,
      error: err.message,
    });
    return { sent: 0, failed: 1, error: err.message };
  }
}

export async function sendToUser(userId, options) {
  const payload = buildPayload(options);
  payload.include_aliases = { external_id: [String(userId)] };
  payload.target_channel = "push";

  try {
    const result = await sendNotification(payload);
    const recipients = result.recipients || 0;

    await recordHistory({
      title: options.title,
      body: options.body,
      target: "user",
      targetValue: String(userId),
      sentBy: null,
      sentCount: recipients,
      onesignalId: result.id,
    });

    console.log("[OneSignal] Sent to user", userId, "— recipients:", recipients);
    return { sent: recipients, failed: 0, error: null };
  } catch (err) {
    console.error("[OneSignal] Send to user", userId, "failed:", err.message);
    await recordHistory({
      title: options.title,
      body: options.body,
      target: "user",
      targetValue: String(userId),
      sentBy: null,
      sentCount: 0,
      error: err.message,
    });
    return { sent: 0, failed: 1, error: err.message };
  }
}

export async function sendToUsers(userIds, options) {
  const payload = buildPayload(options);
  payload.include_aliases = { external_id: userIds.map(String) };
  payload.target_channel = "push";

  try {
    const result = await sendNotification(payload);
    const recipients = result.recipients || 0;

    await recordHistory({
      title: options.title,
      body: options.body,
      target: "multiple_users",
      targetValue: userIds.join(","),
      sentBy: null,
      sentCount: recipients,
      onesignalId: result.id,
    });

    console.log("[OneSignal] Sent to", userIds.length, "users — recipients:", recipients);
    return { sent: recipients, failed: 0, error: null };
  } catch (err) {
    console.error("[OneSignal] Send to multiple users failed:", err.message);
    await recordHistory({
      title: options.title,
      body: options.body,
      target: "multiple_users",
      targetValue: userIds.join(","),
      sentBy: null,
      sentCount: 0,
      error: err.message,
    });
    return { sent: 0, failed: 1, error: err.message };
  }
}

export async function sendToSegment(segmentName, options) {
  const payload = buildPayload(options);
  payload.included_segments = [segmentName];

  try {
    const result = await sendNotification(payload);
    const recipients = result.recipients || 0;

    await recordHistory({
      title: options.title,
      body: options.body,
      target: "segment",
      targetValue: segmentName,
      sentBy: null,
      sentCount: recipients,
      onesignalId: result.id,
    });

    console.log("[OneSignal] Sent to segment", segmentName, "— recipients:", recipients);
    return { sent: recipients, failed: 0, error: null };
  } catch (err) {
    console.error("[OneSignal] Send to segment", segmentName, "failed:", err.message);
    await recordHistory({
      title: options.title,
      body: options.body,
      target: "segment",
      targetValue: segmentName,
      sentBy: null,
      sentCount: 0,
      error: err.message,
    });
    return { sent: 0, failed: 1, error: err.message };
  }
}

export async function sendToCommittee(committeeId, options) {
  const { data: members, error } = await supabase
    .from("members")
    .select("id")
    .eq("committee", committeeId)
    .eq("enabled", 1);

  if (error) {
    console.error("[OneSignal] Committee query error:", error.message);
    return { sent: 0, failed: 1, error: error.message };
  }

  if (!members || members.length === 0) {
    console.log("[OneSignal] No members found in committee:", committeeId);
    return { sent: 0, failed: 0, error: null };
  }

  const userIds = members.map((m) => m.id);
  console.log("[OneSignal] Committee", committeeId, "has", userIds.length, "enabled members");
  return sendToUsers(userIds, options);
}

async function recordHistory({ title, body, target, targetValue, sentBy, sentCount, onesignalId, error }) {
  try {
    const { error: insertError } = await supabase.from("notification_history").insert({
      title,
      body,
      target,
      target_value: targetValue || null,
      sent_by: sentBy || null,
      sent_count: sentCount || 0,
      onesignal_id: onesignalId || null,
      error: error || null,
      created_at: new Date().toISOString(),
    });
    if (insertError) console.error("[OneSignal] History error:", insertError.message);
  } catch (err) {
    console.error("[OneSignal] History exception:", err.message);
  }
}

export { getConfig, buildPayload, sendNotification, recordHistory };

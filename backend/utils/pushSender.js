import { supabase } from "../config/supabase.js";
import { getFirebaseMessaging, getFirebaseConfig } from "../config/firebase-admin.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const FCM_BATCH_SIZE = 500;

const IMPORTANCE_MAP = {
  silent: { priority: "normal", android: { priority: "min" }, webpush: { TTL: 0 } },
  default: { priority: "normal", android: { priority: "normal" }, webpush: { TTL: 86400 } },
  high: { priority: "high", android: { priority: "high" }, webpush: { TTL: 86400 } },
  urgent: { priority: "high", android: { priority: "max" }, webpush: { TTL: 604800 } },
};

const CHANNEL_MAP = {
  general: { id: "mtclub_general", name: "General", description: "General notifications from MT Club", importance: "default" },
  events: { id: "mtclub_events", name: "Events", description: "Event updates and new events", importance: "high" },
  attendance: { id: "mtclub_attendance", name: "Attendance", description: "Attendance reminders and confirmations", importance: "high" },
  announcements: { id: "mtclub_announcements", name: "Announcements", description: "Important announcements", importance: "high" },
  emergency: { id: "mtclub_emergency", name: "Emergency", description: "Critical emergency notifications", importance: "max" },
};

const FATAL_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
  "messaging/invalid-recipient",
  "messaging/unregistered-device",
]);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function truncateToken(token) {
  return token.length > 25 ? token.substring(0, 25) + "..." : token;
}

function getFirebaseError() {
  const config = getFirebaseConfig();
  if (config.initialized) return null;
  return config.error || "Firebase Admin not initialized";
}

function buildFcmPayload(options) {
  const { title, body, image, badge, sound, collapseId, deepLink, channel, data, importance, ttl } = options;
  const imp = IMPORTANCE_MAP[importance] || IMPORTANCE_MAP.default;
  const ch = CHANNEL_MAP[channel] || CHANNEL_MAP.general;

  const notification = { title: title || "MT Club", body: body || "" };
  if (image) notification.image = image;

  const fcmData = { _notificationId: Date.now().toString(36), ...(data && typeof data === "object" ? data : {}) };
  if (deepLink) { fcmData.deepLink = deepLink; fcmData.screen = deepLink; }
  if (collapseId) fcmData.collapseId = collapseId;

  const message = {
    notification,
    data: fcmData,
    android: {
      priority: imp.android?.priority || "normal",
      notification: { channelId: ch.id, sound: sound !== false ? (sound || "default") : undefined, clickAction: "OPEN_ACTIVITY", icon: "mt_logo" },
    },
    webpush: {
      headers: { TTL: String(ttl !== undefined ? ttl : (imp.webpush?.TTL || 86400)), Urgency: imp.priority === "high" ? "high" : "normal" },
      notification: { icon: "/mt-logo.png", badge: badge || "/mt-logo.png", image: image || undefined, actions: [], tag: collapseId || undefined },
    },
    apns: {
      payload: { aps: { sound: sound !== false ? (sound || "default") : undefined, badge: badge || undefined, "content-available": 1 } },
    },
  };

  if (sound === false) {
    delete message.android.notification.sound;
    delete message.apns.payload.aps.sound;
  }

  return message;
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function deduplicateTokens(tokenList) {
  const seen = new Set();
  const unique = [];
  for (const t of tokenList) {
    if (!seen.has(t)) { seen.add(t); unique.push(t); }
  }
  if (unique.length < tokenList.length) {
    console.log(`[Push API] Deduplicated: ${tokenList.length} → ${unique.length} unique tokens`);
  }
  return unique;
}

function logTokenSamples(tokens) {
  const samples = tokens.slice(0, 3);
  console.log("[Push API] Token samples (first 25 chars each):");
  samples.forEach((t, i) => {
    console.log(`[Push API]   [${i + 1}] "${truncateToken(t)}" (length=${t.length})`);
  });
}

async function sendMulticast(message, tokens, attempt = 1) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    const reason = getFirebaseError();
    return { sent: 0, failed: tokens.length, error: reason, invalidTokens: [] };
  }

  try {
    const response = await messaging.sendEachForMulticast({ ...message, tokens });
    const sent = response.successCount;
    const failed = response.failureCount;
    const invalidTokens = [];

    if (failed > 0) {
      console.log(`[Push API] --- Per-token failure details ---`);
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code || "unknown";
          const errMsg = resp.error?.message || String(resp.error);
          console.log(`[Push API]   FAILED token="${truncateToken(tokens[idx])}" error.code="${errCode}" error.message="${errMsg}"`);

          if (FATAL_ERROR_CODES.has(errCode)) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });
      console.log(`[Push API] --- End failure details ---`);
    }

    return { sent, failed, invalidTokens, error: null };
  } catch (err) {
    console.error(`[Push API] sendEachForMulticast exception (attempt ${attempt}/${MAX_RETRIES}):`, err.message);
    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS * attempt);
      return sendMulticast(message, tokens, attempt + 1);
    }
    return { sent: 0, failed: tokens.length, error: err.message, invalidTokens: [] };
  }
}

async function fetchAllMemberTokens() {
  const { data: members, error: membersError } = await supabase
    .from("members").select("id, name");

  if (membersError) { console.error("[Push API] fetchAllMembers error:", membersError.message); return { memberTokens: [], totalMembers: 0, membersWithDevice: 0, membersWithoutDevice: 0 }; }

  const { data: tokens, error: tokensError } = await supabase
    .from("push_tokens").select("user_id, token");

  if (tokensError) { console.error("[Push API] fetchAllTokens error:", tokensError.message); return { memberTokens: [], totalMembers: members?.length || 0, membersWithDevice: 0, membersWithoutDevice: members?.length || 0 }; }

  const tokenMap = new Map();
  for (const t of tokens || []) {
    if (!tokenMap.has(t.user_id)) {
      tokenMap.set(t.user_id, t.token);
    }
  }

  const memberTokens = [];
  let noDeviceCount = 0;

  for (const m of members || []) {
    const token = tokenMap.get(m.id);
    if (token) {
      memberTokens.push({ memberId: m.id, name: m.name, token });
    } else {
      noDeviceCount++;
      console.log(`[Push API] Member ${m.id} (${m.name}) has no registered device.`);
    }
  }

  const totalMembers = (members || []).length;
  const membersWithDevice = memberTokens.length;

  console.log(`[Push API] Total members: ${totalMembers}`);
  console.log(`[Push API] Members with registered devices: ${membersWithDevice}`);
  console.log(`[Push API] Members without registered devices: ${noDeviceCount}`);

  return { memberTokens, totalMembers, membersWithDevice, membersWithoutDevice: noDeviceCount };
}

async function removeInvalidTokens(invalidTokens) {
  if (invalidTokens.length === 0) return;
  console.log(`[Push API] Removing ${invalidTokens.length} invalid token(s) from push_tokens...`);
  const { error } = await supabase.from("push_tokens").delete().in("token", invalidTokens);
  if (error) console.error("[Push API] Failed to remove invalid tokens:", error.message);
  else console.log(`[Push API] Removed ${invalidTokens.length} invalid token(s) successfully`);
}

async function recordHistory({ title, body, target, sentBy, sentCount, error: sendError }) {
  try {
    const { error } = await supabase.from("notification_history").insert({
      title, body, target, target_value: null, sent_by: sentBy || null,
      sent_count: sentCount || 0, onesignal_id: null, error: sendError || null,
      created_at: new Date().toISOString(),
    });
    if (error) console.error("[Push API] History error:", error.message);
  } catch (err) {
    console.error("[Push API] History exception:", err.message);
  }
}

export async function sendPush(options, sentBy) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    const reason = getFirebaseError();
    console.error("[Push API] Cannot send — Firebase Admin not initialized:", reason);
    await recordHistory({ title: options.title, body: options.body, target: "all", sentBy, sentCount: 0, error: reason });
    return { sent: 0, failed: 1, error: reason, totalMembers: 0, membersWithDevice: 0, membersWithoutDevice: 0 };
  }

  const { memberTokens, totalMembers, membersWithDevice, membersWithoutDevice } = await fetchAllMemberTokens();

  if (memberTokens.length === 0) {
    console.log("[Push API] No members with registered devices — nothing to send");
    await recordHistory({ title: options.title, body: options.body, target: "all", sentBy, sentCount: 0, error: "No registered devices found" });
    return { sent: 0, failed: 0, error: "No registered devices found", totalMembers, membersWithDevice, membersWithoutDevice };
  }

  const allTokens = memberTokens.map((mt) => mt.token);
  const tokens = await deduplicateTokens(allTokens);
  console.log(`[Push API] Valid tokens to send: ${tokens.length}`);

  logTokenSamples(tokens);

  const message = buildFcmPayload(options);
  let totalSent = 0;
  let totalFailed = 0;
  const allInvalid = [];

  const batches = chunkArray(tokens, FCM_BATCH_SIZE);
  for (const batch of batches) {
    const result = await sendMulticast(message, batch);
    totalSent += result.sent;
    totalFailed += result.failed;
    allInvalid.push(...result.invalidTokens);
  }

  await removeInvalidTokens(allInvalid);

  console.log(`[Push API] =============================`);
  console.log(`[Push API] Total members:           ${totalMembers}`);
  console.log(`[Push API] Members with device:      ${membersWithDevice}`);
  console.log(`[Push API] Members without device:   ${membersWithoutDevice}`);
  console.log(`[Push API] Success count:            ${totalSent}`);
  console.log(`[Push API] Failure count:            ${totalFailed}`);
  console.log(`[Push API] Invalid (removed):        ${allInvalid.length}`);
  console.log(`[Push API] =============================`);

  const errorSummary = totalFailed > 0 ? `${totalFailed} delivery failed` : null;
  await recordHistory({
    title: options.title, body: options.body, target: "all", sentBy, sentCount: totalSent,
    error: errorSummary,
  });

  return { sent: totalSent, failed: totalFailed, error: errorSummary, totalMembers, membersWithDevice, membersWithoutDevice };
}

const sendPushToAll = sendPush;
export { sendPushToAll, IMPORTANCE_MAP, CHANNEL_MAP, buildFcmPayload };

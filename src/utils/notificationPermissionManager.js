import OneSignal from "react-onesignal";
import axios from "../utils/axios";

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || "";

let initialized = false;
let initPromise = null;

const L = {
  google: (...a) => console.log("[GOOGLE]", ...a),
  onesignal: (...a) => console.log("[ONESIGNAL]", ...a),
  push: (...a) => console.log("[PUSH]", ...a),
  sync: (...a) => console.log("[SYNC]", ...a),
  device: (...a) => console.log("[DEVICE]", ...a),
  subscription: (...a) => console.log("[SUBSCRIPTION]", ...a),
  recovery: (...a) => console.log("[RECOVERY]", ...a),
};

const W = {
  push: (...a) => console.warn("[PUSH]", ...a),
  sync: (...a) => console.warn("[SYNC]", ...a),
  recovery: (...a) => console.warn("[RECOVERY]", ...a),
};

const E = {
  push: (...a) => console.error("[PUSH]", ...a),
  onesignal: (...a) => console.error("[ONESIGNAL]", ...a),
  recovery: (...a) => console.error("[RECOVERY]", ...a),
};

function detectBrowser() {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox/")) return "firefox";
  if (ua.includes("Edg/")) return "edge";
  if (ua.includes("Chrome/")) return "chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome")) return "safari";
  return "other";
}

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  if (/Mac/i.test(ua)) return "macos";
  if (/Win/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
  return "other";
}

export function getDeviceInfo() {
  return {
    browser: detectBrowser(),
    platform: detectPlatform(),
    language: navigator.language || "en",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    userAgent: navigator.userAgent,
    lastSeen: new Date().toISOString(),
  };
}

export function isPushSupported() {
  const platform = detectPlatform();
  const browser = detectBrowser();
  if (platform === "ios" && browser !== "safari") return false;
  if (!("Notification" in window)) return false;
  return true;
}

export function isIOSafariNonPWA() {
  const platform = detectPlatform();
  const browser = detectBrowser();
  if (platform !== "ios" || browser !== "safari") return false;
  return !window.navigator.standalone;
}

export async function initOneSignalSafe() {
  if (initialized) return true;

  if (!ONESIGNAL_APP_ID) {
    E.push("VITE_ONESIGNAL_APP_ID not set — cannot initialize OneSignal");
    return false;
  }

  if (!isPushSupported()) {
    W.push("Push not supported on this browser/platform — skipping init");
    return false;
  }

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      L.onesignal("Initializing OneSignal SDK | App ID:", ONESIGNAL_APP_ID.substring(0, 8) + "...");

      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin:
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1",
        autoResubscribe: false,
        notifyButton: { enable: false },
        serviceWorkerParam: "/OneSignalSDKWorker.js",
        serviceWorkerUpdaterPath: "/OneSignalSDKWorker.js",
        promptOptions: {
          slidedown: { enabled: false, autoPrompt: false },
          native: { enabled: false, autoShow: false },
        },
      });

      initialized = true;
      L.onesignal("OneSignal SDK initialized successfully");
      return true;
    } catch (err) {
      E.onesignal("OneSignal init FAILED:", err.message);
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}

export function getPermissionStatus() {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestPermissionManual() {
  if (!initialized) {
    const ok = await initOneSignalSafe();
    if (!ok) return false;
  }

  const current = Notification.permission;
  if (current === "granted") return true;
  if (current === "denied") return false;

  L.push("Requesting browser push permission...");
  try {
    const result = await OneSignal.Notifications.requestPermission(true);
    L.push("Permission result:", Notification.permission);
    return result === true;
  } catch (err) {
    E.push("Permission request error:", err.message);
    return false;
  }
}

export function getExistingSubscriptionId() {
  try {
    return OneSignal.User.PushSubscription.id || null;
  } catch {
    return null;
  }
}

export function getExternalId() {
  try {
    return OneSignal.User.externalId || null;
  } catch {
    return null;
  }
}

export function isOptedIn() {
  try {
    return OneSignal.User.PushSubscription.optedIn === true;
  } catch {
    return false;
  }
}

export function getOneSignalUserId() {
  try {
    return OneSignal.User?.id || null;
  } catch {
    return null;
  }
}

export async function ensureExternalId(googleSub) {
  if (!googleSub || typeof googleSub !== "string") {
    E.onesignal("ensureExternalId called without valid googleSub:", googleSub, "— refusing to set external ID");
    return false;
  }

  if (!initialized) {
    const ok = await initOneSignalSafe();
    if (!ok) return false;
  }

  const current = getExternalId();
  if (current === googleSub) {
    L.google("External ID already set to googleSub:", current);
    return true;
  }

  if (current && current !== googleSub) {
    E.onesignal("External ID mismatch! Current:", current, "Expected:", googleSub, "— re-logging in");
  }

  L.google("Setting OneSignal external ID to googleSub:", googleSub.substring(0, 12) + "...");
  try {
    await OneSignal.login(googleSub);
    L.google("OneSignal login OK | External ID:", googleSub.substring(0, 12) + "...");
    return true;
  } catch (err) {
    E.onesignal("OneSignal login FAILED:", err.message, "| googleSub:", googleSub.substring(0, 12) + "...");
    return false;
  }
}

export function waitForSubscription(timeoutMs = 15000) {
  const existing = getExistingSubscriptionId();
  if (existing) {
    L.subscription("Already subscribed | Subscription ID:", existing);
    return Promise.resolve(existing);
  }

  L.subscription("Waiting for push subscription (timeout:", timeoutMs, "ms)...");

  return new Promise((resolve) => {
    let resolved = false;

    const done = (value) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      try {
        OneSignal.User.PushSubscription.removeEventListener("change", onChange);
      } catch {}
      resolve(value);
    };

    const timer = setTimeout(() => {
      W.recovery("Subscription wait timed out after", timeoutMs, "ms");
      done(null);
    }, timeoutMs);

    function onChange(event) {
      const id = event?.current?.id;
      if (id) {
        L.subscription("Push subscription created | ID:", id);
        done(id);
      }
    }

    try {
      OneSignal.User.PushSubscription.addEventListener("change", onChange);
    } catch {
      done(null);
    }
  });
}

export async function saveSubscriptionToBackend(googleSub, authToken) {
  const subscriptionId = getExistingSubscriptionId();
  const oneSignalUserId = getOneSignalUserId();

  if (!subscriptionId || !authToken) {
    W.sync("Cannot save subscription — subId:", !!subscriptionId, "authToken:", !!authToken);
    return false;
  }

  try {
    const deviceInfo = getDeviceInfo();
    await axios.post(
      "/api/notifications/save-oneSignal-id",
      {
        onesignalId: subscriptionId,
        onesignalUserId: oneSignalUserId,
        ...deviceInfo,
      },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    L.device("Saved subscription to backend | Sub:", subscriptionId, "| Player:", oneSignalUserId || "pending");
    return true;
  } catch (err) {
    W.sync("Backend save failed:", err.response?.status, err.message);
    return false;
  }
}

export async function verifyAndRecover(googleSub, authToken) {
  if (!googleSub) {
    E.recovery("verifyAndRecover called without googleSub — skipping");
    return false;
  }

  if (!initialized) {
    const ok = await initOneSignalSafe();
    if (!ok) return false;
  }

  const permission = getPermissionStatus();
  if (permission !== "granted") {
    W.recovery("Cannot verify — permission is", permission, "(need 'granted')");
    return false;
  }

  const hasSub = !!getExistingSubscriptionId();
  const hasExtId = !!getExternalId();
  const optedIn = isOptedIn();
  const currentExtId = getExternalId();

  L.recovery("Verify start | Sub:", hasSub ? "YES" : "NO", "| ExtID:", currentExtId || "NONE", "| OptedIn:", optedIn ? "YES" : "NO");

  let fixed = false;

  if (!hasSub) {
    L.recovery("No push subscription — waiting for recovery...");
    const subId = await waitForSubscription(10000);
    if (!subId) {
      E.recovery("Recovery FAILED: no subscription after 10s wait");
      return false;
    }
    L.recovery("Subscription recovered:", subId);
    fixed = true;
  }

  if (!optedIn && getExistingSubscriptionId()) {
    L.recovery("Subscription exists but not opted in — retrying opt-in...");
    try {
      OneSignal.User.PushSubscription.optIn();
      L.recovery("Opt-in retried successfully");
      fixed = true;
    } catch (err) {
      W.recovery("Opt-in retry failed:", err.message);
    }
  }

  if (!hasExtId || currentExtId !== googleSub) {
    L.recovery("External ID missing or mismatch — setting to googleSub");
    const ok = await ensureExternalId(googleSub);
    if (ok) fixed = true;
  }

  if (authToken) {
    await saveSubscriptionToBackend(googleSub, authToken);
  }

  if (fixed) {
    L.recovery("Self-healing completed for googleSub:", googleSub.substring(0, 12) + "...");
  }

  return true;
}

let subscriptionChangeListener = null;
let syncGoogleSub = null;

function getStoredToken() {
  try {
    const saved = localStorage.getItem("user");
    if (saved) return JSON.parse(saved)?.token || null;
  } catch {}
  return null;
}

export function startSubscriptionSync(googleSub) {
  stopSubscriptionSync();

  if (!initialized || !googleSub) return;

  syncGoogleSub = googleSub;

  subscriptionChangeListener = (event) => {
    const newId = event?.current?.id;
    const prevId = event?.previous?.id;

    if (newId !== prevId) {
      L.sync("Subscription changed:", prevId || "none", "->", newId || "none");
      const token = getStoredToken();
      if (newId) {
        L.sync("Re-saving subscription after change...");
        saveSubscriptionToBackend(googleSub, token);
      } else {
        W.sync("Subscription disappeared — attempting recovery...");
        verifyAndRecover(googleSub, token);
      }
    }
  };

  try {
    OneSignal.User.PushSubscription.addEventListener("change", subscriptionChangeListener);
    L.sync("Subscription sync started for googleSub:", googleSub.substring(0, 12) + "...");
  } catch {}
}

export function stopSubscriptionSync() {
  if (subscriptionChangeListener) {
    try {
      OneSignal.User.PushSubscription.removeEventListener("change", subscriptionChangeListener);
    } catch {}
    subscriptionChangeListener = null;
    syncGoogleSub = null;
  }
}

export function onNotificationClicked(callback) {
  if (!initialized) return () => {};
  OneSignal.Notifications.addEventListener("click", callback);
  return () => {
    OneSignal.Notifications.removeEventListener("click", callback);
  };
}

export async function logoutUser() {
  if (!initialized) return;
  try {
    await OneSignal.logout();
    L.onesignal("Logged out of OneSignal");
  } catch (err) {
    E.onesignal("Logout error:", err.message);
  }
}

export function getDiagnostics() {
  const browser = detectBrowser();
  const platform = detectPlatform();

  return {
    initialized,
    pushSupported: isPushSupported(),
    browser,
    platform,
    permission: getPermissionStatus(),
    subscriptionId: getExistingSubscriptionId(),
    externalId: getExternalId(),
    optedIn: isOptedIn(),
    oneSignalUserId: getOneSignalUserId(),
    sdkVersion: "react-onesignal@3.5.6 / OneSignal Web SDK v16",
    timestamp: new Date().toISOString(),
  };
}

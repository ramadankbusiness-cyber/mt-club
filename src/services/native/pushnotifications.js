import { Platform } from "../platform";
import { StorageService } from "./storage";
import { initFirebase, getFirebaseMessaging } from "../../config/firebase";
import axios from "../../utils/axios";

const FCM_TOKEN_KEY = "mtclub_fcm_token";
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";
const SW_URL = "/firebase-messaging-sw.js";

let initialized = false;
let foregroundAttached = false;
let foregroundUnsub = null;
let swRegistration = null;

function isWebPushSupported() {
  return "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
}

async function registerServiceWorker() {
  if (swRegistration) return swRegistration;

  try {
    swRegistration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    console.log("[FCM] Service worker registered:", swRegistration.scope);

    if (swRegistration.installing) {
      swRegistration.installing.addEventListener("statechange", (e) => {
        console.log("[FCM] SW state changed:", e.target.state);
      });
    }

    return swRegistration;
  } catch (err) {
    console.error("[FCM] SW registration failed:", err.message);
    return null;
  }
}

async function ensureInit() {
  if (initialized) return true;
  if (Platform.isNative()) { initialized = true; return true; }
  if (Platform.isWeb() && isWebPushSupported()) {
    initialized = await initFirebase();
    return initialized;
  }
  return false;
}

async function getToken() {
  await ensureInit();

  if (Platform.isWeb()) {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      console.error("[FCM] getToken: messaging instance is null");
      return null;
    }

    const registration = await registerServiceWorker();
    if (!registration) {
      console.error("[FCM] getToken: no service worker registration");
      return null;
    }

    try {
      const { getToken: getFcmToken } = await import("firebase/messaging");
      console.log("[FCM] Calling getToken with vapidKey length:", VAPID_KEY.length);
      console.log("[FCM] SW registration scope:", registration.scope);

      const token = await getFcmToken(messaging, {
        vapidKey: VAPID_KEY || undefined,
        serviceWorkerRegistration: registration,
      });

      if (token) {
        console.log("[FCM] Token obtained:", token.substring(0, 30) + "...");
        await StorageService.set(FCM_TOKEN_KEY, token);
        return token;
      } else {
        console.error("[FCM] getToken returned null/empty token");
      }
    } catch (err) {
      console.error("[FCM] getToken failed:", err.code || "", err.message);
    }
    return null;
  }

  if (Platform.isNative()) {
    try {
      const { Device } = await import("@capacitor/device");
      const info = await Device.getId();
      if (info?.identifier) return info.identifier;
    } catch {}
  }

  return null;
}

async function requestPermissionAndRegister(authToken) {
  if (!authToken) return null;

  await ensureInit();

  if (Platform.isWeb()) {
    if (Notification.permission === "default") {
      console.log("[FCM] Requesting notification permission...");
      try { await Notification.requestPermission(); } catch {}
    }
    console.log("[FCM] Notification permission:", Notification.permission);

    if (Notification.permission !== "granted") {
      console.warn("[FCM] Permission not granted — aborting registration");
      return null;
    }
  }

  const token = await getToken();
  if (!token) return null;

  const platform = Platform.isAndroid() ? "android" : Platform.isIOS() ? "ios" : "web";

  try {
    await axios.post(
      "/api/notifications/register",
      { token, platform },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log("[FCM] Registered:", { platform, token: token.substring(0, 20) + "..." });
  } catch (err) {
    console.error("[FCM] Backend registration failed:", err.message);
  }

  return token;
}

function onForegroundMessage(callback) {
  if (Platform.isNative()) return () => {};

  if (foregroundAttached) return foregroundUnsub || (() => {});

  const messaging = getFirebaseMessaging();
  if (!messaging) return () => {};

  foregroundAttached = true;

  import("firebase/messaging").then(({ onMessage }) => {
    console.log("[FCM] onMessage listener attached");
    const unsub = onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message received:", JSON.stringify(payload));

      const n = payload.notification || {};
      const d = payload.data || {};
      const title = n.title || "MT Club";
      const body = n.body || "";

      callback({ title, body, data: d });

      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, { body, icon: "/mt-logo.png", badge: "/mt-logo.png" });
          console.log("[FCM] Foreground browser notification displayed");
        } catch (err) {
          console.error("[FCM] new Notification() failed:", err.message);
        }
      }

      if (window.showToast && title) {
        window.showToast(body || title, "info", 5000);
      }
    });

    foregroundUnsub = unsub;
  }).catch((err) => {
    console.error("[FCM] Failed to attach onMessage:", err.message);
  });

  return () => {
    if (foregroundUnsub) foregroundUnsub();
    foregroundAttached = false;
    foregroundUnsub = null;
  };
}

export const NotificationService = {
  requestPermissionAndRegister,
  onForegroundMessage,
};

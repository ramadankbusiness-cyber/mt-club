import OneSignal from "react-onesignal";
import axios from "../utils/axios";

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || "";
let initialized = false;

export async function initOneSignal() {
  if (initialized) {
    console.log("[OneSignal] Already initialized");
    return true;
  }
  if (!ONESIGNAL_APP_ID) {
    console.error("[OneSignal] VITE_ONESIGNAL_APP_ID is not set");
    return false;
  }
  try {
    console.log("[OneSignal] Initializing with app ID:", ONESIGNAL_APP_ID.substring(0, 8) + "...");
    await OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: window.location.hostname === "localhost",
      serviceWorkerPath: "/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/" },
      promptOptions: {
        slidedown: { enabled: false },
        pageViews: { enabled: false },
      },
    });
    initialized = true;
    console.log("[OneSignal] Initialized");
    return true;
  } catch (err) {
    console.error("[OneSignal] Init error:", err.message);
    return false;
  }
}

export async function requestPermission() {
  try {
    if (!initialized) await initOneSignal();
    if (!initialized) return false;

    const permission = await OneSignal.Notifications.permissionNative();
    console.log("[OneSignal] Current permission:", permission);

    if (permission === "granted") return true;
    if (permission === "denied") {
      console.warn("[OneSignal] Permission denied by user");
      return false;
    }

    console.log("[OneSignal] Requesting permission...");
    const result = await OneSignal.Notifications.requestPermission();
    console.log("[OneSignal] Permission result:", result);
    return result === true;
  } catch (err) {
    console.error("[OneSignal] Permission error:", err.message);
    return false;
  }
}

export async function loginUser(userId, authToken) {
  try {
    if (!initialized) await initOneSignal();
    if (!initialized) return false;

    await OneSignal.login(String(userId));
    console.log("[OneSignal] User logged in with external_id:", userId);

    try {
      const subscriptionId = await OneSignal.User.PushSubscription.getId();
      if (subscriptionId && authToken) {
        console.log("[OneSignal] Saving subscription ID to backend:", subscriptionId);
        await axios.post("/api/notifications/save-oneSignal-id", { onesignalId: subscriptionId }, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
      }
    } catch (saveErr) {
      console.warn("[OneSignal] Failed to save subscription ID to backend:", saveErr.message);
    }

    return true;
  } catch (err) {
    console.error("[OneSignal] Login error:", err.message);
    return false;
  }
}

export async function logoutUser() {
  try {
    if (!initialized) return;
    await OneSignal.logout();
    console.log("[OneSignal] User logged out");
  } catch (err) {
    console.error("[OneSignal] Logout error:", err.message);
  }
}

export async function isPushEnabled() {
  try {
    if (!initialized) return false;
    return await OneSignal.Notifications.isPushPermissionGranted();
  } catch {
    return false;
  }
}

export function onNotificationClicked(callback) {
  if (!initialized) return () => {};
  try {
    OneSignal.Notifications.addEventListener("click", (event) => {
      console.log("[OneSignal] Notification clicked:", JSON.stringify(event));
      callback(event);
    });
    return () => {
      try {
        OneSignal.Notifications.removeEventListener("click", callback);
      } catch {}
    };
  } catch (err) {
    console.error("[OneSignal] Click listener error:", err.message);
    return () => {};
  }
}

export const OneSignalService = {
  init: initOneSignal,
  requestPermission,
  loginUser,
  logoutUser,
  isPushEnabled,
  onNotificationClicked,
};

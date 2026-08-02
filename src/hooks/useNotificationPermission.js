import { useState, useEffect, useCallback, useRef } from "react";
import * as NotifManager from "../utils/notificationPermissionManager";

const DISMISS_KEY = "mt_notif_dismissed_at";
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

function shouldShowModal() {
  try {
    const dismissedAt = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
    if (!dismissedAt) return true;
    return Date.now() - dismissedAt > COOLDOWN_MS;
  } catch {
    return true;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {}
}

function getPerm() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function useNotificationPermission(user) {
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [showDeniedModal, setShowDeniedModal] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const status = getPerm();
    console.log("[PUSH] Initial permission check:", status);

    if (status === "unsupported") return;

    if (NotifManager.isIOSafariNonPWA()) {
      if (shouldShowModal()) setShowIOSModal(true);
      return;
    }

    if (status === "denied") {
      setShowDeniedModal(true);
      return;
    }

    if (status === "default") {
      if (shouldShowModal()) setShowEnableModal(true);
    }
  }, []);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      const status = getPerm();

      if (status === "default" && shouldShowModal() && !showEnableModal) {
        setShowEnableModal(true);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [showEnableModal]);

  const handleEnable = useCallback(async () => {
    console.log("[PUSH] User clicked Enable — requesting permission");
    setProcessing(true);
    try {
      const ok = await NotifManager.initOneSignalSafe();
      if (!ok) {
        console.error("[PUSH] OneSignal failed to initialize — cannot request permission");
        return;
      }

      const granted = await NotifManager.requestPermissionManual();

      if (granted) {
        console.log("[PUSH] Permission granted by user");
        setShowEnableModal(false);

        console.log("[PUSH] Waiting for push subscription...");
        const subId = await NotifManager.waitForSubscription(15000);

        if (!subId) {
          console.warn("[PUSH] No subscription created after permission grant");
          return;
        }

        console.log("[PUSH] Subscription ready:", subId);
        console.log("[PUSH] Identity will be set by useNotifications hook after permission is granted");
      } else {
        const after = getPerm();

        if (after === "denied") {
          setShowEnableModal(false);
          setShowDeniedModal(true);
        } else {
          markDismissed();
          setShowEnableModal(false);
        }
      }
    } catch (err) {
      console.error("[PUSH] Enable error:", err.message);
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleNotNow = useCallback(() => {
    markDismissed();
    setShowEnableModal(false);
  }, []);

  const handleDeniedClose = useCallback(() => {
    setShowDeniedModal(false);
  }, []);

  const handleOpenSettings = useCallback(() => {
    const browser = NotifManager.getDiagnostics().browser;
    if (browser === "chrome") {
      window.open("chrome://settings/content/notifications", "_blank");
    } else if (browser === "edge") {
      window.open("edge://settings/content/notifications", "_blank");
    } else if (browser === "firefox") {
      window.open("about:preferences#privacy", "_blank");
    }
  }, []);

  const handleIOSClose = useCallback(() => {
    markDismissed();
    setShowIOSModal(false);
  }, []);

  return {
    permission: getPerm(),
    showEnableModal,
    showDeniedModal,
    showIOSModal,
    processing,
    handleEnable,
    handleNotNow,
    handleDeniedClose,
    handleOpenSettings,
    handleIOSClose,
  };
}

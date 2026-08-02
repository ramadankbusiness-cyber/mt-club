import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as NotifManager from "../utils/notificationPermissionManager";

export function useNotifications(user) {
  const setupSubRef = useRef(null);
  const unsubRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onAutoLogout() {
      setupSubRef.current = null;
      unsubRef.current = null;
    }
    window.addEventListener("auth:logout", onAutoLogout);
    return () => window.removeEventListener("auth:logout", onAutoLogout);
  }, []);

  useEffect(() => {
    const googleSub = user?.googleSub;
    if (!googleSub || !user?.token) {
      if (setupSubRef.current) {
        console.log("[ONESIGNAL] User lost googleSub or token — stopping sync");
      }
      setupSubRef.current = null;
      NotifManager.stopSubscriptionSync();
      return;
    }

    if (setupSubRef.current === googleSub) return;
    setupSubRef.current = googleSub;

    let cancelled = false;

    async function setup() {
      const permission = NotifManager.getPermissionStatus();
      if (permission !== "granted") {
        console.log("[ONESIGNAL] Permission not granted (" + permission + ") — skipping identity setup");
        return;
      }

      console.log("[ONESIGNAL] Starting identity setup for googleSub:", googleSub.substring(0, 12) + "...");

      const initOk = await NotifManager.initOneSignalSafe();
      if (cancelled || !initOk) return;

      await NotifManager.ensureExternalId(googleSub);
      if (cancelled) return;

      await NotifManager.verifyAndRecover(googleSub, user.token);
      if (cancelled) return;

      NotifManager.startSubscriptionSync(googleSub);

      unsubRef.current = NotifManager.onNotificationClicked((event) => {
        try {
          const data = event?.notification?.data;
          const url = data?.deepLink || data?.screen || data?.url;
          if (url) {
            console.log("[PUSH] Notification clicked — navigating to:", url);
            if (url.startsWith("http")) {
              window.location.href = url;
            } else {
              navigate(url.startsWith("/") ? url : `/${url}`);
            }
          }
        } catch {}
      });

      console.log("[ONESIGNAL] Identity setup complete | External ID:", NotifManager.getExternalId(), "| Sub:", NotifManager.getExistingSubscriptionId());
    }

    setup();

    return () => {
      cancelled = true;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      NotifManager.stopSubscriptionSync();
    };
  }, [user?.googleSub, user?.token, navigate]);
}

import { useEffect, useRef, useCallback } from "react";
import { OneSignalService } from "../services/onesignal";

const RETRY_DELAYS = [2000, 5000, 15000];

export function useNotifications(user) {
  const initedRef = useRef(false);
  const timersRef = useRef([]);
  const loggedInRef = useRef(false);

  const cleanup = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (!user?.id || !user?.token) {
      console.log("[OneSignal Hook] No user — skipping");
      initedRef.current = false;
      loggedInRef.current = false;
      return;
    }

    if (initedRef.current && loggedInRef.current) {
      console.log("[OneSignal Hook] Already initialized and logged in — skipping");
      return;
    }

    cleanup();

    async function setup(attempt) {
      try {
        if (!initedRef.current) {
          const ok = await OneSignalService.init();
          if (!ok) {
            console.warn("[OneSignal Hook] Init failed, attempt", attempt);
            scheduleRetry(attempt);
            return;
          }
          initedRef.current = true;
        }

        if (!loggedInRef.current) {
          const granted = await OneSignalService.requestPermission();
          console.log("[OneSignal Hook] Permission:", granted ? "granted" : "denied");

          await OneSignalService.loginUser(user.id, user.token);
          loggedInRef.current = true;
          console.log("[OneSignal Hook] Setup complete for user", user.id);
        }
      } catch (err) {
        console.error("[OneSignal Hook] Setup error:", err.message);
        scheduleRetry(attempt);
      }
    }

    function scheduleRetry(attempt) {
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.log("[OneSignal Hook] Retry", attempt + 1, "in", delay / 1000, "s");
        const t = setTimeout(() => setup(attempt + 1), delay);
        timersRef.current.push(t);
      } else {
        console.warn("[OneSignal Hook] All retries exhausted");
      }
    }

    setup(0);

    const unsub = OneSignalService.onNotificationClicked((event) => {
      const data = event.notification?.data || {};
      const url = data.deepLink || data.screen || data.url || "/";
      if (url && window.location) {
        window.location.href = url;
      }
    });

    return () => {
      cleanup();
      unsub();
    };
  }, [user?.id, user?.token, cleanup]);
}

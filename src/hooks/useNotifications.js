import { useEffect, useRef } from "react";
import { NotificationService } from "../services/native/pushnotifications";

export function useNotifications(user) {
  const setupDoneRef = useRef(false);

  useEffect(() => {
    if (!user?.token) { setupDoneRef.current = false; return; }
    if (setupDoneRef.current) return;
    setupDoneRef.current = true;

    NotificationService.requestPermissionAndRegister(user.token);

    const unsub = NotificationService.onForegroundMessage(() => {});

    return () => { unsub(); };
  }, [user?.token]);
}

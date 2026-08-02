import { createContext, useState, useEffect, useCallback } from "react";
import axios from "../utils/axios";
import { logoutUser, stopSubscriptionSync } from "../utils/notificationPermissionManager";

export const AuthContext = createContext();

const NOTIF_DISMISS_KEY = "mt_notif_dismissed_at";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [googleLinked, setGoogleLinked] = useState(false);

  const fetchPoints = useCallback(async () => {
    const saved = localStorage.getItem("user");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (!parsed?.token) return;
      const res = await axios.get("/api/auth/profile", {
        headers: { Authorization: `Bearer ${parsed.token}` },
      });
      const updated = { ...parsed, points: res.data.points ?? 0, attendanceCount: res.data.attendanceCount ?? 0 };
      setUser(prev => {
        if (prev && prev.points === updated.points && prev.attendanceCount === updated.attendanceCount) return prev;
        return updated;
      });
      localStorage.setItem("user", JSON.stringify(updated));
    } catch {}
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        setGoogleLinked(!!parsed.googleSub);
      } catch {}
    }
    setLoading(false);
    fetchPoints();
    const interval = setInterval(fetchPoints, 15000);
    return () => clearInterval(interval);
  }, [fetchPoints]);

  useEffect(() => {
    function onAutoLogout() {
      stopSubscriptionSync();
      setUser(null);
      setGoogleLinked(false);
    }
    window.addEventListener("auth:logout", onAutoLogout);
    return () => window.removeEventListener("auth:logout", onAutoLogout);
  }, []);

  const login = (userData) => {
    setUser(userData);
    setGoogleLinked(!!userData.googleSub);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const markGoogleLinked = (googleSub) => {
    setUser(prev => {
      const updated = { ...prev, googleSub, googleVerified: true };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
    setGoogleLinked(true);
  };

  const unlinkGoogle = useCallback(async () => {
    try {
      await axios.delete("/api/auth/google/unlink", {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
    } catch {}
    setUser(prev => {
      const updated = { ...prev };
      delete updated.googleSub;
      delete updated.googleVerified;
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
    setGoogleLinked(false);
  }, [user?.token]);

  const logout = useCallback(async () => {
    stopSubscriptionSync();
    localStorage.removeItem("user");
    localStorage.removeItem(NOTIF_DISMISS_KEY);
    setUser(null);
    setGoogleLinked(false);
    try {
      await logoutUser();
    } catch (err) {
      console.warn("[Auth] OneSignal logout error:", err?.message);
    }
  }, []);

  const openAuth = () => setShowAuth(true);
  const closeAuth = () => setShowAuth(false);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, showAuth, openAuth, closeAuth, googleLinked, markGoogleLinked, unlinkGoogle, refreshPoints: fetchPoints }}>
      {children}
    </AuthContext.Provider>
  );
};

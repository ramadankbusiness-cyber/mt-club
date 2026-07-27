import { createContext, useState, useEffect, useCallback } from "react";
import axios from "../utils/axios";
import { OneSignalService } from "../services/onesignal";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [loading, setLoading] = useState(true);

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
    if (saved) { try { setUser(JSON.parse(saved)); } catch {} }
    setLoading(false);
    fetchPoints();
    const interval = setInterval(fetchPoints, 15000);
    return () => clearInterval(interval);
  }, [fetchPoints]);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    OneSignalService.logoutUser().catch(() => {});
    localStorage.removeItem("user");
    setUser(null);
  };

  const openAuth = () => setShowAuth(true);
  const closeAuth = () => setShowAuth(false);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, showAuth, openAuth, closeAuth, refreshPoints: fetchPoints }}>
      {children}
    </AuthContext.Provider>
  );
};

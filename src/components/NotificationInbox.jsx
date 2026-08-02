import { useState, useEffect, useCallback } from "react";
import { Bell, Check, CheckCheck, Trash2, Filter, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../utils/axios";

const categoryColors = {
  general: "bg-white/10 text-gray-400",
  events: "bg-cyan-500/20 text-cyan-400",
  attendance: "bg-green-500/20 text-green-400",
  announcements: "bg-blue-500/20 text-blue-400",
  emergency: "bg-red-500/20 text-red-400",
  welcome: "bg-purple-500/20 text-purple-400",
  updates: "bg-orange-500/20 text-orange-400",
};

export default function NotificationInbox({ user, onBack }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const loadNotifications = useCallback(async (pageNum = 1, cat = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (cat) params.set("category", cat);
      const res = await axios.get(`/api/notifications/inbox?${params}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setNotifications(pageNum === 1 ? (res.data?.data || []) : (prev) => [...prev, ...(res.data?.data || [])]);
      setTotal(res.data?.total || 0);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch {} finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => {
    setPage(1);
    loadNotifications(1, category);
  }, [category, loadNotifications]);

  const markAsRead = async (id) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await axios.put(`/api/notifications/inbox/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
    } catch {}
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await axios.put("/api/notifications/inbox/read-all", {}, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
    } catch {}
  };

  const deleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setTotal((prev) => prev - 1);
    try {
      await axios.delete(`/api/notifications/inbox/${id}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
    } catch {}
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadNotifications(nextPage, category);
  };

  const categories = [
    { value: "", label: "All" },
    { value: "general", label: "General" },
    { value: "events", label: "Events" },
    { value: "attendance", label: "Attendance" },
    { value: "announcements", label: "Announcements" },
    { value: "emergency", label: "Emergency" },
    { value: "welcome", label: "Welcome" },
    { value: "updates", label: "Updates" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="sticky top-0 z-40 bg-white/5 backdrop-blur-xl border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg bg-white/10 hover:bg-white/15 transition">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="text-xs px-2 py-0.5 bg-cyan-500 text-black rounded-full font-bold">{unreadCount}</span>
              )}
            </h1>
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className="p-2 rounded-lg bg-white/10 hover:bg-white/15 transition">
            <Filter size={18} />
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="p-2 rounded-lg bg-white/10 hover:bg-white/15 transition" title="Mark all read">
              <CheckCheck size={18} />
            </button>
          )}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 pt-3 overflow-x-auto pb-1">
                {categories.map((c) => (
                  <button key={c.value} onClick={() => setCategory(c.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                      category === c.value ? "bg-cyan-500 text-black" : "bg-white/10 text-gray-400 hover:bg-white/15"
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 space-y-2">
        {loading && notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-white/20 border-t-cyan-500 rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-sm mt-3">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell size={48} className="mx-auto text-gray-600 mb-3" />
            <p className="text-gray-400">No notifications yet</p>
          </div>
        ) : (
          <>
            {notifications.map((n) => (
              <motion.div
                key={n.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className={`p-4 rounded-2xl border transition ${
                  n.read ? "bg-white/5 border-white/5" : "bg-white/10 border-white/10"
                }`}
                onClick={() => { if (!n.read) markAsRead(n.id); if (n.deep_link) window.location.href = n.deep_link; }}
              >
                <div className="flex items-start gap-3">
                  {!n.read && <div className="w-2 h-2 rounded-full bg-cyan-500 mt-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${n.read ? "text-gray-300" : "text-white"}`}>{n.title}</p>
                      {n.category && n.category !== "general" && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryColors[n.category] || "bg-white/10 text-gray-400"}`}>
                          {n.category}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${n.read ? "text-gray-500" : "text-gray-300"}`}>{n.body}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-gray-600">{new Date(n.created_at).toLocaleString()}</span>
                      {n.deep_link && (
                        <span className="text-[10px] text-cyan-400">Tap to view</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.read && (
                      <button onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition" title="Mark as read">
                        <Check size={14} className="text-gray-400" />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition" title="Delete">
                      <Trash2 size={14} className="text-gray-400" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            {notifications.length < total && (
              <button onClick={loadMore} disabled={loading}
                className="w-full py-3 text-sm text-gray-400 hover:text-white bg-white/5 rounded-xl transition disabled:opacity-40">
                {loading ? "Loading..." : "Load More"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

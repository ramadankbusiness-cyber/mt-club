import axios from "../utils/axios";

export async function fetchUnreadCount(token) {
  if (!token) return 0;
  try {
    const res = await axios.get("/api/notifications/inbox?limit=1&unread=true", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data?.unreadCount || 0;
  } catch {
    return 0;
  }
}

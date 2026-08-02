import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: { "Content-Type": "application/json" },
});

let hasLoggedOut = false;

export function triggerLogout() {
  if (hasLoggedOut) return;
  hasLoggedOut = true;
  localStorage.removeItem("user");
  localStorage.removeItem("mt_notif_dismissed_at");
  window.dispatchEvent(new Event("auth:logout"));
  setTimeout(() => { hasLoggedOut = false; }, 2000);
}

axiosInstance.interceptors.request.use((config) => {
  try {
    const saved = localStorage.getItem("user");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.token) {
        config.headers.Authorization = `Bearer ${parsed.token}`;
      }
    }
  } catch {}
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401 || status === 403) {
      const url = error.config?.url || "";
      if (!url.includes("/api/auth/login") && !url.includes("/api/auth/register")) {
        console.warn(`[Axios] ${status} — auto-logging out:`, url);
        triggerLogout();
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

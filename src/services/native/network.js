import { Network as CapNetwork } from "@capacitor/network";
import { Platform } from "../platform";

let listeners = [];
let statusCallback = null;

export const NetworkService = {
  async getStatus() {
    if (Platform.isNative()) {
      const status = await CapNetwork.getStatus();
      return { connected: status.connected, connectionType: status.connectionType };
    }
    return { connected: navigator.onLine, connectionType: navigator.connection?.effectiveType || "unknown" };
  },

  async addListener(callback) {
    statusCallback = callback;

    if (Platform.isNative()) {
      const handle = await CapNetwork.addListener("networkStatusChange", (status) => {
        callback({ connected: status.connected, connectionType: status.connectionType });
      });
      listeners.push(handle);
      return handle;
    }

    const onOnline = () => callback({ connected: true, connectionType: "unknown" });
    const onOffline = () => callback({ connected: false, connectionType: "none" });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    listeners.push({ remove: () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); } });
    return { remove: () => listeners.forEach(l => l.remove?.()) };
  },

  removeAllListeners() {
    listeners.forEach(l => l.remove?.());
    listeners = [];
  },
};

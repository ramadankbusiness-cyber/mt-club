import { StatusBar, Style } from "@capacitor/status-bar";
import { Platform } from "../platform";

export const StatusBarService = {
  async configure() {
    if (!Platform.isNative()) return;

    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: "#0a0a0a" });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch (err) {
      console.warn("[StatusBar] configure error:", err.message);
    }
  },

  async hide() {
    if (Platform.isNative()) {
      try { await StatusBar.hide(); } catch {}
    }
  },

  async show() {
    if (Platform.isNative()) {
      try { await StatusBar.show(); } catch {}
    }
  },
};

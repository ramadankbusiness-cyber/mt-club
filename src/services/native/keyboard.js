import { Keyboard } from "@capacitor/keyboard";
import { Platform } from "../platform";

export const KeyboardService = {
  async configure() {
    if (!Platform.isNative()) return;

    try {
      await Keyboard.setScroll({ resize: "body" });
    } catch (err) {
      console.warn("[Keyboard] configure error:", err.message);
    }
  },

  async hide() {
    if (Platform.isNative()) {
      try { await Keyboard.hide(); } catch {}
    }
  },
};

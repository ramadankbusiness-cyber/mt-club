import { App } from "@capacitor/app";
import { Platform } from "../platform";

export const AppService = {
  async addBackButtonListener(callback) {
    if (!Platform.isNative()) return { remove: () => {} };

    const handle = await App.addListener("backButton", ({ canGoBack }) => {
      callback({ canGoBack });
    });
    return handle;
  },

  async addAppStateListener(callback) {
    if (!Platform.isNative()) {
      const onFocus = () => callback({ isActive: true });
      const onBlur = () => callback({ isActive: false });
      window.addEventListener("focus", onFocus);
      window.addEventListener("blur", onBlur);
      return { remove: () => { window.removeEventListener("focus", onFocus); window.removeEventListener("blur", onBlur); } };
    }

    const handle = await App.addListener("appStateChange", (state) => {
      callback({ isActive: state.isActive });
    });
    return handle;
  },

  async exitApp() {
    if (Platform.isNative()) {
      await App.exitApp();
    }
  },
};

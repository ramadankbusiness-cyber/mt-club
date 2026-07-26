import { SplashScreen } from "@capacitor/splash-screen";
import { Platform } from "../platform";

export const SplashScreenService = {
  async hide() {
    if (!Platform.isNative()) return;
    try {
      await SplashScreen.hide();
    } catch (err) {
      console.warn("[SplashScreen] hide error:", err.message);
    }
  },
};

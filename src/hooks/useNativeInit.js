import { useEffect } from "react";
import { Platform } from "../services/platform";
import { StatusBarService } from "../services/native/statusbar";
import { SplashScreenService } from "../services/native/splashscreen";
import { KeyboardService } from "../services/native/keyboard";

export function useNativeInit() {
  useEffect(() => {
    if (!Platform.isNative()) return;

    const init = async () => {
      await StatusBarService.configure();
      await KeyboardService.configure();
      await SplashScreenService.hide();
    };

    init();
  }, []);
}

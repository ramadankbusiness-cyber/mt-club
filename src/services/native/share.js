import { Share as CapShare } from "@capacitor/share";
import { Platform } from "../platform";

export const ShareService = {
  async share(options = {}) {
    if (Platform.isNative()) {
      try {
        await CapShare.share({
          title: options.title || "MT Club",
          text: options.text || "",
          url: options.url || "",
          dialogTitle: options.dialogTitle || "Share with",
        });
        return { completed: true };
      } catch (err) {
        if (err.message?.includes("cancelled")) return { completed: false };
        throw err;
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: options.title, text: options.text, url: options.url });
        return { completed: true };
      } catch (err) {
        if (err.name === "AbortError") return { completed: false };
        throw err;
      }
    }

    if (options.url) {
      await navigator.clipboard?.writeText(options.url);
      return { completed: true, method: "clipboard" };
    }
    return { completed: false };
  },
};

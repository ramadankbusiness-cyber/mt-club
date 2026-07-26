import { Device } from "@capacitor/device";
import { Platform } from "../platform";

export const DeviceService = {
  async getInfo() {
    if (Platform.isNative()) {
      const info = await Device.getInfo();
      return {
        platform: info.platform,
        model: info.model,
        OSVersion: info.osVersion,
        manufacturer: info.manufacturer,
        isVirtual: info.isVirtual,
      };
    }
    const ua = navigator.userAgent;
    return {
      platform: "web",
      model: ua,
      OSVersion: "",
      manufacturer: "",
      isVirtual: false,
    };
  },

  async getBattery() {
    if (Platform.isNative()) {
      const status = await Device.getBatteryInfo();
      return { level: status.batteryLevel, charging: status.isCharging };
    }
    if ("getBattery" in navigator) {
      const battery = await navigator.getBattery();
      return { level: battery.level, charging: battery.charging };
    }
    return { level: 1, charging: false };
  },
};

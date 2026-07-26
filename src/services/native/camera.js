import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Platform } from "../platform";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pickFromWeb(options = {}) {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = options.accept || "image/*";
    input.capture = options.rearCamera ? "environment" : "user";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return reject(new Error("No file selected"));
      const base64 = await fileToBase64(file);
      resolve({ base64, webPath: URL.createObjectURL(file), format: "jpeg" });
    };
    input.click();
  });
}

export const CameraService = {
  async getPhoto(options = {}) {
    const opts = {
      quality: options.quality ?? 90,
      allowEditing: options.allowEditing ?? false,
      resultType: CameraResultType.Base64,
      source: options.rearCamera !== false ? CameraSource.Camera : CameraSource.Camera,
      width: options.width,
      height: options.height,
      correctOrientation: true,
    };

    if (Platform.isNative()) {
      try {
        return await CapCamera.getPhoto(opts);
      } catch (err) {
        if (err.message?.includes("cancelled") || err.message?.includes("User cancelled")) {
          throw new Error("cancelled");
        }
        throw err;
      }
    }

    return pickFromWeb({ accept: "image/*", rearCamera: options.rearCamera !== false });
  },

  async checkPermissions() {
    if (Platform.isNative()) {
      const status = await CapCamera.checkPermissions();
      return status.camera;
    }
    return "granted";
  },

  async requestPermissions() {
    if (Platform.isNative()) {
      const status = await CapCamera.requestPermissions();
      return status.camera;
    }
    return "granted";
  },
};

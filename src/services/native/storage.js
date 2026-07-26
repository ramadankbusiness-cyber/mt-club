import { Preferences } from "@capacitor/preferences";
import { Platform } from "../platform";

const MEMORY_KEY = "mtclub_prefs";

let memoryCache = null;

async function loadMemory() {
  if (memoryCache) return memoryCache;
  if (Platform.isNative()) {
    const { value } = await Preferences.get({ key: MEMORY_KEY });
    memoryCache = value ? JSON.parse(value) : {};
  } else {
    const raw = localStorage.getItem(MEMORY_KEY);
    memoryCache = raw ? JSON.parse(raw) : {};
  }
  return memoryCache;
}

async function saveMemory(data) {
  memoryCache = data;
  const json = JSON.stringify(data);
  if (Platform.isNative()) {
    await Preferences.set({ key: MEMORY_KEY, value: json });
  } else {
    localStorage.setItem(MEMORY_KEY, json);
  }
}

export const StorageService = {
  async get(key) {
    const data = await loadMemory();
    return data[key] ?? null;
  },

  async set(key, value) {
    const data = await loadMemory();
    data[key] = value;
    await saveMemory(data);
  },

  async remove(key) {
    const data = await loadMemory();
    delete data[key];
    await saveMemory(data);
  },

  async clear() {
    memoryCache = {};
    if (Platform.isNative()) {
      await Preferences.clear();
    } else {
      localStorage.removeItem(MEMORY_KEY);
    }
  },
};

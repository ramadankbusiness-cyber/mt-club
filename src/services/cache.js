import { Preferences } from "@capacitor/preferences";
import { Platform } from "./platform";

const PREFIX = "mtclub_cache_";
const DEFAULT_TTL = 30 * 60 * 1000;

function getKey(key) {
  return PREFIX + key;
}

async function storeGet(key) {
  if (Platform.isNative()) {
    const { value } = await Preferences.get({ key: getKey(key) });
    return value ? JSON.parse(value) : null;
  }
  const raw = localStorage.getItem(getKey(key));
  return raw ? JSON.parse(raw) : null;
}

async function storeSet(key, value) {
  const json = JSON.stringify(value);
  if (Platform.isNative()) {
    await Preferences.set({ key: getKey(key), value: json });
  } else {
    localStorage.setItem(getKey(key), json);
  }
}

async function storeRemove(key) {
  if (Platform.isNative()) {
    await Preferences.remove({ key: getKey(key) });
  } else {
    localStorage.removeItem(getKey(key));
  }
}

export const CacheService = {
  async get(key) {
    const entry = await storeGet(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      await storeRemove(key);
      return null;
    }
    return entry.data;
  },

  async set(key, data, ttl = DEFAULT_TTL) {
    await storeSet(key, {
      data,
      expiry: ttl > 0 ? Date.now() + ttl : null,
      cachedAt: Date.now(),
    });
  },

  async remove(key) {
    await storeRemove(key);
  },

  async getMeta(key) {
    const entry = await storeGet(key);
    if (!entry) return null;
    return { cachedAt: entry.cachedAt, expiry: entry.expiry };
  },

  async clearAll() {
    if (Platform.isNative()) {
      await Preferences.clear();
    } else {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
      keys.forEach((k) => localStorage.removeItem(k));
    }
  },
};

import { useState, useEffect, useRef, useCallback } from "react";
import { CacheService } from "../services/cache";
import { NetworkService } from "../services/native/network";

const CACHE_TTL = {
  events: 15 * 60 * 1000,
  team: 60 * 60 * 1000,
  gallery: 15 * 60 * 1000,
  achievements: 24 * 60 * 60 * 1000,
};

export function useCachedData(cacheKey, fetchFn, options = {}) {
  const { ttl = CACHE_TTL[cacheKey] || 15 * 60 * 1000, enabled = true } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const fetchKeyRef = useRef(0);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!enabled) { setLoading(false); return; }

    const key = ++fetchKeyRef.current;
    setLoading(true);
    setError(null);

    if (!forceRefresh) {
      try {
        const cached = await CacheService.get(cacheKey);
        if (cached && mountedRef.current && key === fetchKeyRef.current) {
          setData(cached);
          setFromCache(true);
          setLoading(false);
        }
      } catch {}
    }

    try {
      const network = await NetworkService.getStatus();
      if (!network.connected) {
        if (!forceRefresh && mountedRef.current && key === fetchKeyRef.current) {
          setLoading(false);
        }
        return;
      }

      const freshData = await fetchFn();
      if (mountedRef.current && key === fetchKeyRef.current) {
        setData(freshData);
        setFromCache(false);
        setLoading(false);
      }
      await CacheService.set(cacheKey, freshData, ttl);
    } catch (err) {
      if (mountedRef.current && key === fetchKeyRef.current) {
        if (!data) {
          setError(err.message || "Failed to load data");
          setLoading(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, [cacheKey, fetchFn, ttl, enabled]);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => { mountedRef.current = false; };
  }, [loadData]);

  const refresh = useCallback(() => loadData(true), [loadData]);

  return { data, loading, fromCache, error, refresh };
}

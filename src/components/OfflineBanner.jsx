import { useState, useEffect } from "react";
import { WifiOff, Database } from "lucide-react";
import { useNetwork } from "../context/NetworkContext";
import { CacheService } from "../services/cache";

const CACHE_KEYS = ["events", "team", "gallery"];

export default function OfflineBanner() {
  const { online } = useNetwork();
  const [show, setShow] = useState(false);
  const [cachedCount, setCachedCount] = useState(0);

  useEffect(() => {
    if (online) {
      setTimeout(() => setShow(false), 2500);
    } else {
      setShow(true);
      checkCachedData();
    }
  }, [online]);

  const checkCachedData = async () => {
    let count = 0;
    for (const key of CACHE_KEYS) {
      const cached = await CacheService.get(key);
      if (cached && (Array.isArray(cached) ? cached.length > 0 : true)) count++;
    }
    setCachedCount(count);
  };

  if (!show) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-300 ${
        online
          ? "bg-green-500/90 text-white translate-y-0"
          : "bg-gray-800/95 text-gray-200 translate-y-0"
      }`}
      style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      {online ? (
        <>
          <WifiOff size={16} />
          <span>Back online</span>
        </>
      ) : (
        <>
          {cachedCount > 0 ? (
            <>
              <Database size={16} className="text-cyan-400" />
              <span>
                Offline — showing cached data ({cachedCount} {cachedCount === 1 ? "source" : "sources"})
              </span>
            </>
          ) : (
            <>
              <WifiOff size={16} className="text-orange-400" />
              <span>You're offline. Some features may be limited.</span>
            </>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useCallback } from "react";

export function useRetry() {
  const [retrying, setRetrying] = useState(false);

  const withRetry = useCallback(async (fn, maxRetries = 2) => {
    let lastErr;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (i < maxRetries) {
          setRetrying(true);
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
    }
    setRetrying(false);
    throw lastErr;
  }, []);

  return { withRetry, retrying };
}

export function getErrorMessage(err) {
  if (!err) return "An unknown error occurred";
  if (err.response) {
    const msg = err.response.data?.message;
    if (err.response.status === 401) return "Session expired. Please sign in again.";
    if (err.response.status === 403) return "You don't have permission for this action.";
    if (err.response.status === 404) return "The requested resource was not found.";
    if (err.response.status === 429) return "Too many requests. Please try again later.";
    if (err.response.status >= 500) return "Server error. Please try again later.";
    return msg || "Request failed";
  }
  if (err.message === "Network Error" || !navigator.onLine) return "No internet connection. Check your network.";
  if (err.name === "AbortError" || err.code === "ECONNABORTED") return "Request timed out. Please try again.";
  return err.message || "Something went wrong";
}

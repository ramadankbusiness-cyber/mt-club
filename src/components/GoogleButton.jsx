import { useRef, useEffect } from "react";
import { loadGoogleScript, renderGoogleButton, isGoogleConfigured } from "../services/googleAuth";

export default function GoogleButton({ onSuccess, onError, text = "Sign in with Google", disabled }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isGoogleConfigured() || !containerRef.current) return;

    let mounted = true;

    loadGoogleScript()
      .then(() => {
        if (!mounted || !containerRef.current) return;
        renderGoogleButton(containerRef.current, (response) => {
          if (response?.credential) {
            onSuccess?.(response.credential);
          }
        });
      })
      .catch((err) => {
        if (mounted) onError?.(err.message);
      });

    return () => { mounted = false; };
  }, [onSuccess, onError]);

  if (!isGoogleConfigured()) {
    return (
      <button disabled className="w-full py-3 px-4 bg-white/5 border border-white/20 rounded-xl text-gray-500 text-sm cursor-not-allowed">
        Google Sign-In unavailable
      </button>
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="flex justify-center w-full" />
    </div>
  );
}

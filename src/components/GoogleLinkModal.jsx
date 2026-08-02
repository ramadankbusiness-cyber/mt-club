import { useState, useEffect, useRef } from "react";
import axios from "../utils/axios";
import GoogleButton from "./GoogleButton";
import { isGoogleConfigured } from "../services/googleAuth";

export default function GoogleLinkModal({ visible, user, onLinked }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const modalRef = useRef();

  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    }
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  useEffect(() => {
    if (!visible || !user?.token) return;

    const checkStatus = async () => {
      try {
        const res = await axios.get("/api/auth/google/status", {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.data?.verified) {
          onLinked?.(res.data);
        }
      } catch {}
    };
    checkStatus();
  }, [visible, user?.token, onLinked]);

  const handleGoogleSuccess = async (credential) => {
    setError("");
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/google/link", { credential }, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (res.data?.linked) {
        setSuccess(true);
        setShowCheckmark(true);
        setTimeout(() => onLinked?.(res.data), 1800);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || "";
      const msg = err.response?.data?.message || "Failed to link Google account";
      console.error("[GoogleLink] FAILED:", msg, detail);
      setError(detail || msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = (msg) => {
    if (msg) setError("Google sign-in failed: " + msg);
  };

  if (!visible || !user) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #0a0a1a 0%, #0d1117 40%, #0a0a2e 100%)",
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Google Account Linking Required"
    >
      {/* Ambient glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-15"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)" }} />

      <div
        ref={modalRef}
        className="relative w-[92%] max-w-md p-8 rounded-3xl border border-white/10 shadow-2xl text-center"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
          animation: "linkModalIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {success ? (
          <div className="py-6" style={{ animation: "fadeInUp 0.4s ease-out" }}>
            {showCheckmark && (
              <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
                  animation: "scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: "drawCheck 0.4s ease-out 0.2s both" }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
            <h2 className="text-2xl font-bold text-white mb-2">Account Linked!</h2>
            <p className="text-sm text-gray-400">Continuing to MT Club...</p>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-6 w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(99,102,241,0.2))" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">Link your Google Account</h2>

            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
              To continue using MT Club, you must link your Google account once.
              This allows us to securely identify your account across all your devices
              and ensure important club notifications always reach you.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="flex justify-center">
              {isGoogleConfigured() ? (
                <GoogleButton onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
              ) : (
                <p className="text-gray-500 text-sm">Google Identity Services not configured</p>
              )}
            </div>

            {loading && (
              <p className="text-xs text-gray-400 mt-4" style={{ animation: "pulse 1.5s infinite" }}>
                Verifying your Google identity...
              </p>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes linkModalIn {
          from { opacity: 0; transform: scale(0.9) translateY(30px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        @keyframes drawCheck {
          from { stroke-dashoffset: 30; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

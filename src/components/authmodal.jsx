import { useState, useEffect, useContext, useRef } from "react";
import axios from "../utils/axios";
import { AuthContext } from "../context/AuthContext";

export default function AuthModal() {
  const { closeAuth, login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const modalRef = useRef();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Please fill all fields");
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/login", { email, password });
      login(res.data);
      closeAuth();
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) closeAuth(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in">
      <div ref={modalRef} className="relative w-[90%] max-w-md p-8 rounded-2xl border border-white/20 shadow-2xl" style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        animation: "modalIn 0.25s ease-out"
      }}>
        <button onClick={closeAuth} className="absolute top-3 right-4 text-white/60 hover:text-white text-2xl" aria-label="Close sign in dialog">&times;</button>

        <h2 className="text-2xl font-bold text-white mb-2">Sign In</h2>
        <p className="text-sm text-gray-400 mb-6">Welcome back to MT Club</p>

        {error && <p className="text-red-400 text-sm mb-4 bg-red-500/10 p-2 rounded">{error}</p>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="input-premium" aria-label="Email address" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="input-premium" aria-label="Password" />
          <button type="submit" disabled={loading}
            className="btn-primary w-full mt-2">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.92) translateY(20px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

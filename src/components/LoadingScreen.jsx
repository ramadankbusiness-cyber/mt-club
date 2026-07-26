import { useState, useEffect } from "react";

export default function LoadingScreen({ onComplete }) {
  const [phase, setPhase] = useState("loading");

  useEffect(() => {
    const minDisplay = setTimeout(() => {
      setPhase("fading-out");
    }, 1800);

    const finish = setTimeout(() => {
      setPhase("done");
      onComplete?.();
    }, 2400);

    return () => {
      clearTimeout(minDisplay);
      clearTimeout(finish);
    };
  }, [onComplete]);

  if (phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-600 ${
        phase === "fading-out" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ backgroundColor: "#000000" }}
    >
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-40 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)" }} />

      {/* Logo + ring container */}
      <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
        {/* Rotating outer ring */}
        <div className="loader-ring" />

        {/* Glassmorphism card behind logo */}
        <div className="absolute inset-4 rounded-full"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
          }} />

        {/* Logo */}
        <img
          src="/mt-logo.png"
          alt="MT Club"
          className="relative z-10 loader-logo"
          style={{ width: 80, height: 80, objectFit: "contain" }}
        />
      </div>

      {/* Brand name */}
      <h1 className="mt-8 text-xl font-bold tracking-wide text-white/90 loader-fade-up">
        MT Club
      </h1>
      <p className="mt-2 text-sm text-white/40 loader-fade-up-delayed">
        Loading experience
      </p>

      {/* Progress bar */}
      <div className="mt-8 w-48 h-1 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full loader-progress" />
      </div>
    </div>
  );
}

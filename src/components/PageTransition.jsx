import { useLocation, Routes } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";

export default function PageTransition({ children }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [stage, setStage] = useState("entered"); // "entered" | "exiting" | "entering"
  const [showLoader, setShowLoader] = useState(false);
  const loaderDelay = useRef(null);
  const isInitial = useRef(true);

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }

    const pathChanged = location.pathname !== displayLocation.pathname;
    const searchChanged = location.search !== displayLocation.search;

    if (pathChanged || searchChanged) {
      setStage("exiting");
      loaderDelay.current = setTimeout(() => setShowLoader(true), 150);
    }

    return () => clearTimeout(loaderDelay.current);
  }, [location.pathname, location.search, displayLocation.pathname, displayLocation.search]);

  const handleContentTransitionEnd = useCallback(
    (e) => {
      if (e.propertyName !== "opacity") return;

      if (stage === "exiting") {
        clearTimeout(loaderDelay.current);
        setDisplayLocation(location);
        setShowLoader(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setStage("entering");
          });
        });
      } else if (stage === "entering") {
        setStage("entered");
      }
    },
    [stage, location]
  );

  return (
    <>
      <div
        className={`transition-opacity duration-300 ease-in-out ${
          stage === "exiting" ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onTransitionEnd={handleContentTransitionEnd}
      >
        <Routes key={displayLocation.pathname + displayLocation.search} location={displayLocation}>
          {children}
        </Routes>
      </div>

      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center
          transition-opacity duration-300 ease-in-out pointer-events-none
          ${showLoader ? "opacity-100" : "opacity-0"}`}
        style={{ backgroundColor: "#000000" }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)",
          }}
        />

        <div
          className="relative flex items-center justify-center"
          style={{ width: 160, height: 160 }}
        >
          <div className="loader-ring" />
          <div
            className="absolute inset-4 rounded-full"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />
          <img
            src="/mt-logo.png"
            alt="MT Club"
            className="relative z-10 loader-logo"
            style={{ width: 80, height: 80, objectFit: "contain" }}
          />
        </div>

        <h1 className="mt-8 text-xl font-bold tracking-wide text-white/90">
          MT Club
        </h1>
        <div className="mt-6 w-32 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full loader-progress" />
        </div>
      </div>
    </>
  );
}

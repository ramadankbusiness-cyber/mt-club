import { useState, useEffect, useContext, useCallback, useRef } from "react";
import Header from "../components/Header";
import { AuthContext } from "../context/AuthContext";
import "./Team.css";
import axios from "../utils/axios";
import { useCachedData } from "../hooks/useCachedData";

const INITIAL_COMMITTEES = [
  { id: "chairman", label: "Chairman of the MT Club Board", headName: "", headImage: "" },
  { id: "leadership", label: "Team Leaders", headName: "", headImage: "", viceName: "", viceImage: "" },
  { id: "oc", label: "OC", headName: "", headImage: "", viceName: "", viceImage: "", leader1Name: "", leader1Image: "", leader2Name: "", leader2Image: "" },
  { id: "tech", label: "Tech", headName: "", headImage: "", viceName: "", viceImage: "", leaderName: "", leaderImage: "" },
  { id: "pr", label: "PR", headName: "", headImage: "", viceName: "", viceImage: "", leaderName: "", leaderImage: "" },
  { id: "hr", label: "HR", headName: "", headImage: "", viceName: "", viceImage: "", leader1Name: "", leader1Image: "", leader2Name: "", leader2Image: "" },
  { id: "logistics", label: "Logistics", headName: "", headImage: "", viceName: "", viceImage: "", leaderName: "", leaderImage: "" },
  { id: "firstaid", label: "First Aid", headName: "", headImage: "", viceName: "", viceImage: "", leaderName: "", leaderImage: "" },
  { id: "media", label: "Media", headName: "", headImage: "", viceName: "", viceImage: "", leaderName: "", leaderImage: "" },
];

function mergeCommittees(serverData) {
  return INITIAL_COMMITTEES.map((c) => {
    const doc = serverData?.[c.id];
    return {
      ...c,
      headName: doc?.head?.name || "",
      headImage: doc?.head?.imageUrl || "",
      viceName: doc?.vice?.name || "",
      viceImage: doc?.vice?.imageUrl || "",
      leader1Name: doc?.leader1?.name || "",
      leader1Image: doc?.leader1?.imageUrl || "",
      leader2Name: doc?.leader2?.name || "",
      leader2Image: doc?.leader2?.imageUrl || "",
      leaderName: doc?.leader?.name || "",
      leaderImage: doc?.leader?.imageUrl || "",
    };
  });
}

export default function TeamPage({ onLoaded }) {
  const { user } = useContext(AuthContext);

  const fetchTeam = useCallback(() =>
    axios.get("/api/team").then((r) => r.data || {}),
    []
  );

  const { data: serverData, loading, fromCache } = useCachedData("team", fetchTeam, { ttl: 60 * 60 * 1000 });

  const committees = serverData ? mergeCommittees(serverData) : INITIAL_COMMITTEES;

  const initials = (name) => {
    try {
      if (typeof name === "string" && name.trim()) {
        return name.trim().split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase();
      }
    } catch (e) {}
    return "?";
  };

  useEffect(() => {
    if (!onLoaded) return;
    const imgs = document.querySelectorAll(".card img");
    if (imgs.length === 0) { onLoaded(); return; }
    let loadedCount = 0;
    imgs.forEach((img) => {
      if (img.complete) loadedCount++;
      else img.onload = () => {
        loadedCount++;
        if (loadedCount === imgs.length) onLoaded();
      };
    });
    if (loadedCount === imgs.length) onLoaded();
  }, [onLoaded, committees]);

  const allMembers = committees.flatMap(c => {
    if (c.id === "chairman") {
      return [{ key: "chairman-head", name: c.headName, image: c.headImage, role: "Chairman of the MT Club Board" }];
    }
    const members = [
      { key: `${c.id}-head`, name: c.headName, image: c.headImage, role: `Head ${c.id === "leadership" ? "MTC" : c.label}` },
      { key: `${c.id}-vice`, name: c.viceName, image: c.viceImage, role: c.id === "leadership" ? "Vice Head MTC" : `Vice Head ${c.label}` },
    ];
    if (c.id === "oc" || c.id === "hr") {
      members.push(
        { key: `${c.id}-leader1`, name: c.leader1Name, image: c.leader1Image, role: `Leader 1 ${c.label}` },
        { key: `${c.id}-leader2`, name: c.leader2Name, image: c.leader2Image, role: `Leader 2 ${c.label}` },
      );
    } else if (c.id !== "leadership") {
      members.push({ key: `${c.id}-leader`, name: c.leaderName, image: c.leaderImage, role: `Leader ${c.label}` });
    }
    return members;
  });

  const trackRef = useRef(null);
  const rafRef = useRef(null);
  const idleTimerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartPos = useRef(0);
  const posRef = useRef(0);
  const lastTimeRef = useRef(null);
  const autoScrolling = useRef(true);
  const isHovering = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function animate(timestamp) {
      if (lastTimeRef.current == null) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;
      const half = track.scrollWidth / 2;
      const speed = (half / 100) * dt;

      if (!isDragging.current && autoScrolling.current && !isHovering.current) {
        posRef.current -= speed;
        if (posRef.current <= -half) posRef.current += half;
        track.style.transform = `translateX(${posRef.current}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const scheduleResume = useCallback(() => {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => { autoScrolling.current = true; }, 4000);
  }, []);

  const handlePointerDown = useCallback((e) => {
    isDragging.current = true;
    autoScrolling.current = false;
    dragStartX.current = e.clientX;
    dragStartPos.current = posRef.current;
    clearTimeout(idleTimerRef.current);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStartX.current;
    posRef.current = dragStartPos.current + dx;
    trackRef.current.style.transform = `translateX(${posRef.current}px)`;
  }, []);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    scheduleResume();
  }, [scheduleResume]);

  const handleWheel = useCallback((e) => {
    autoScrolling.current = false;
    posRef.current -= e.deltaX || e.deltaY;
    if (trackRef.current) trackRef.current.style.transform = `translateX(${posRef.current}px)`;
    scheduleResume();
  }, [scheduleResume]);

  const handleMouseEnter = useCallback(() => { isHovering.current = true; }, []);
  const handleMouseLeave = useCallback(() => { isHovering.current = false; }, []);

  useEffect(() => () => clearTimeout(idleTimerRef.current), []);

  return (
    <main className="relative w-full min-h-screen overflow-hidden">
      <div className="flex flex-col min-h-screen">
        <Header />

        <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />

        <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>

        <div className="marquee-wrapper">
          <div className="marquee-track" ref={trackRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {allMembers.map(m => (
              <div className="card" key={m.key}>
                {m.image ? (
                  <img src={m.image} alt={m.name || `Member ${m.key}`} />
                ) : (
                  <div className="card-placeholder">
                    <span className="card-initials">{initials(m.name)}</span>
                  </div>
                )}
                <div className="card-overlay">
                  <h3>{m.name || "TBD"}</h3>
                  <p>{m.role}</p>
                </div>
              </div>
            ))}
            {allMembers.map(m => (
              <div className="card" key={`copy-${m.key}`} aria-hidden>
                {m.image ? (
                  <img src={m.image} alt={m.name || `Member ${m.key}`} />
                ) : (
                  <div className="card-placeholder">
                    <span className="card-initials">{initials(m.name)}</span>
                  </div>
                )}
                <div className="card-overlay">
                  <h3>{m.name || "TBD"}</h3>
                  <p>{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className="w-full text-center py-6 opacity-80" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
          &copy; 2026 MT Club - All rights reserved
        </footer>
      </div>
    </main>
  );
}

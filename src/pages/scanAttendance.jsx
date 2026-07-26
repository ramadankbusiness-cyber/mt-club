import { useState, useEffect, useContext, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import Header from "../components/Header";
import { BrowserMultiFormatReader } from "@zxing/browser";

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ScanAttendance() {
  const { user, refreshPoints } = useContext(AuthContext);
  const [eventCode, setEventCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(true);
  const controlsRef = useRef(null);
  const codeReaderRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!user?.token) return;
    fetch(`/api/attendance/user/${user.id}`, {
      headers: { Authorization: `Bearer ${user.token}` }
    })
      .then(res => res.json())
      .then(data => setAttendance(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [user?.token]);

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const stopScanner = () => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch {}
      controlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerActive(false);
  };

  const startScanner = async () => {
    setMessage("");
    setScannerActive(true);

    await new Promise(r => setTimeout(r, 50));

    try {
      const videoEl = videoRef.current;
      if (!videoEl) {
        throw new Error("Video element not found");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;

      videoEl.srcObject = stream;
      await videoEl.play();

      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      const controls = await codeReader.decodeFromVideoElement(videoEl, (result, err) => {
        if (result) {
          stopScanner();
          registerAttendance(result.getText());
        }
      });
      controlsRef.current = controls;
    } catch (err) {
      stopScanner();
      setScannerSupported(false);
      setMessage("Camera not available. Use the event code input below.");
      setMessageType("error");
    }
  };

  const registerAttendance = async (data) => {
    let eventData;
    try {
      eventData = typeof data === "string" ? JSON.parse(data) : data;
    } catch {
      setMessage("Invalid QR code. Scan a valid event QR code.");
      setMessageType("error");
      return;
    }

    if (!eventData.eventId && !eventData.eventCode) {
      setMessage("Invalid QR code: no event ID found.");
      setMessageType("error");
      return;
    }

    setLoading(true);

    const alreadyAttended = attendance.some(a => {
      if (eventData.eventId && a.eventId?.toString() === eventData.eventId?.toString()) return true;
      if (eventData.eventCode && a.eventCode === eventData.eventCode) return true;
      return false;
    });
    if (alreadyAttended) {
      setMessage("You've already checked in to this event.");
      setMessageType("warning");
      setLoading(false);
      return;
    }

    let latitude = null;
    let longitude = null;
    let location = "Unknown";

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
      });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
      location = `${latitude},${longitude}`;

      if (eventData.latitude != null && eventData.longitude != null) {
        const dist = haversineDistance(latitude, longitude, eventData.latitude, eventData.longitude);
        const radius = eventData.radius || 100;
        if (dist > radius) {
          setMessage(`You are ${Math.round(dist)}m away from the event location. Must be within ${radius}m to check in.`);
          setMessageType("error");
          setLoading(false);
          return;
        }
      }
    } catch (geoErr) {
      if (eventData.latitude != null && eventData.longitude != null) {
        setMessage("Location access is required for this event. Please enable GPS and try again.");
        setMessageType("error");
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          memberId: user.id,
          eventId: eventData.eventId,
          eventCode: eventData.eventCode,
          location,
          latitude,
          longitude,
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed");

      const pointsMsg = result.pointsAwarded > 0 ? ` (+${result.pointsAwarded}★)` : "";
      const balanceMsg = result.newBalance != null ? ` | Balance: ${result.newBalance}★` : "";
      setMessage((result.message || "Attendance registered successfully!") + pointsMsg + balanceMsg);
      setMessageType("success");
      setEventCode("");
      if (result.newBalance != null) {
        const updatedUser = { ...user, points: result.newBalance };
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
      if (refreshPoints) refreshPoints();

      const updated = await fetch(`/api/attendance/user/${user.id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      const updatedData = await updated.json();
      setAttendance(Array.isArray(updatedData) ? updatedData : []);
    } catch (err) {
      if (err.message?.toLowerCase().includes("already") || err.message?.toLowerCase().includes("duplicate")) {
        setMessage("Already Checked In — you've already registered for this event.");
        setMessageType("info");
      } else {
        setMessage(err.message || "Error registering attendance");
        setMessageType("error");
      }
    }
    setLoading(false);
  };

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    if (!eventCode.trim()) return;
    registerAttendance(JSON.stringify({ eventCode: eventCode.trim() }));
  };

  return (
    <main className="relative w-full h-screen overflow-y-auto overflow-x-hidden">
      <Header />
      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>

      <div className="p-4 sm:p-8 pt-32 max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Register Attendance</h1>
        <p className="text-gray-400 mb-8">Scan the event QR code or enter the event code to check in.</p>

        {user ? (
          <>
            <div className="border border-white/20 p-6 rounded-xl bg-white/5 mb-8">
              <h2 className="text-xl font-semibold mb-4">Scan QR Code</h2>

              {scannerActive && (
                <div className="mb-4 rounded-lg overflow-hidden mx-auto" style={{ maxWidth: "400px" }}>
                  <video
                    ref={videoRef}
                    style={{ width: "100%", display: "block", backgroundColor: "#000" }}
                    playsInline
                    muted
                  />
                </div>
              )}

              <div className="flex gap-3 mb-4">
                {!scannerActive ? (
                  <button onClick={startScanner}
                    disabled={loading}
                    className="btn-primary flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                      <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                      <line x1="7" y1="12" x2="17" y2="12"/>
                      <line x1="7" y1="8" x2="17" y2="8"/>
                      <line x1="7" y1="16" x2="17" y2="16"/>
                    </svg>
                    {scannerSupported ? "Open Camera Scanner" : "Camera Unavailable"}
                  </button>
                ) : (
                  <button onClick={stopScanner}
                    className="btn-danger flex items-center gap-2">
                    Stop Scanner
                  </button>
                )}
              </div>

              <div className="border-t border-white/10 pt-4 mt-2">
                <p className="text-sm text-gray-400 mb-3">
                  {scannerSupported
                    ? "Or enter the event code manually:"
                    : "Enter the event code from the event organizer:"}
                </p>
                <form onSubmit={handleCodeSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={eventCode}
                    onChange={(e) => setEventCode(e.target.value)}
                    placeholder="e.g. EVT-1-abc123"
                    className="input-premium flex-1 font-mono text-sm"
                    aria-label="Event code"
                  />
                  <button
                    type="submit"
                    disabled={loading || !eventCode.trim()}
                    className="btn-primary"
                  >
                    {loading ? "Checking in..." : "Check In"}
                  </button>
                </form>
              </div>

              {message && (
                <p className={`mt-4 p-3 rounded-lg text-sm ${
                  messageType === "success" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                  messageType === "info" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" :
                  messageType === "warning" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                  "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}>
                  {message}
                </p>
              )}
            </div>

            <div className="border border-white/20 p-6 rounded-xl bg-white/5">
              <h2 className="text-xl font-semibold mb-4">Your Attendance History</h2>
              {attendance.length === 0 ? (
                <p className="text-gray-500 text-sm">No events attended yet. Scan a QR code or enter an event code to get started!</p>
              ) : (
                <div className="space-y-3">
                  {Array.isArray(attendance) && attendance.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <p className="font-medium text-cyan-400">{a.eventTitle}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(a.timestamp).toLocaleDateString("en-US", {
                            weekday: "short", year: "numeric", month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500">{a.location !== "Unknown" ? a.location : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">Sign in to register attendance</p>
          </div>
        )}
      </div>
    </main>
  );
}

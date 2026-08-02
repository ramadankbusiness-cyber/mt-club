import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import Header from "../components/Header";
import axios from "../utils/axios";
import { QRCodeCanvas } from "qrcode.react";
import { useToast } from "../components/Toast";
import { formatEventDate } from "../utils/eventDates";

export default function QRCodePage() {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [qrValue, setQrValue] = useState("");
  const [generatedEvent, setGeneratedEvent] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (user?.role !== "admin" || !user?.token) return;
    axios
      .get("/api/admin/events", {
        headers: { Authorization: `Bearer ${user.token}` }
      })
      .then((res) => setEvents(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [user]);

  const handleGenerate = () => {
    if (!selectedEvent || !user?.token) return;
    axios
      .post(
        `/api/admin/events/${selectedEvent}/generate-qr`,
        {},
        { headers: { Authorization: `Bearer ${user.token}` } }
      )
      .then((res) => {
        setQrValue(res.data.qrCode);
        const ev = events.find(e => e.id.toString() === selectedEvent);
        setGeneratedEvent(ev);
        setHistory(prev => [{ event: ev, code: res.data.qrCode, time: new Date() }, ...prev]);
      })
      .catch(() => {});
  };

  const downloadQR = () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `event-${selectedEvent}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <main className="relative w-full h-screen overflow-y-auto overflow-x-hidden">
      <Header />
      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>

      <div className="p-8 pt-32 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">QR Code Generator</h1>
        <p className="text-gray-400 mb-8">Generate QR codes for events. Members scan to register attendance.</p>

        {user?.role === "admin" ? (
          <>
            <div className="border border-white/20 p-6 rounded-xl bg-white/5 mb-8">
              <h2 className="text-xl font-semibold mb-4">Generate New QR Code</h2>

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-sm text-gray-400 mb-1 block">Select Event</label>
                  <select
                    value={selectedEvent}
                    onChange={(e) => { setSelectedEvent(e.target.value); setQrValue(""); }}
                    className="w-full p-3 rounded-lg bg-white/10 text-white border border-white/20 [color-scheme:dark]">
                    <option value="">-- Choose an event --</option>
                    {Array.isArray(events) && events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} — {formatEventDate(ev)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!selectedEvent}
                  className="px-6 py-3 bg-cyan-500 text-black rounded-lg font-semibold hover:bg-cyan-400 transition disabled:opacity-50 h-fit"
                >
                  Generate QR
                </button>
              </div>

              {qrValue && generatedEvent && (
                <div className="mt-6 p-6 bg-white/5 border border-white/10 rounded-xl text-center">
                  <h3 className="text-lg font-semibold mb-1">{generatedEvent.title}</h3>
                  <p className="text-sm text-gray-400 mb-4">QR Code — Members scan to check in</p>
                  <div className="inline-block p-4 bg-white rounded-xl">
                    <QRCodeCanvas value={qrValue} size={220} />
                  </div>
                  <p className="mt-3 text-xs text-gray-500 break-all bg-black/30 p-2 rounded">{qrValue}</p>
                  <div className="flex gap-3 justify-center mt-4">
                    <button onClick={downloadQR} className="px-4 py-2 bg-green-500 text-black rounded-lg font-semibold hover:bg-green-400 transition">
                      Download PNG
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(qrValue); toast.success("QR code copied!"); }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition"
                    >
                      Copy Code
                    </button>
                  </div>
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div className="border border-white/20 p-6 rounded-xl bg-white/5">
                <h2 className="text-xl font-semibold mb-4">Generated QR Codes</h2>
                <div className="space-y-3">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <p className="font-medium">{h.event?.title || "Event"}</p>
                        <p className="text-xs text-gray-400">{h.time.toLocaleString()}</p>
                      </div>
                      <span className="text-xs text-gray-500 truncate max-w-[200px]">{h.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">Admin access only</p>
            <p className="text-sm">Sign in as admin to generate QR codes</p>
          </div>
        )}
      </div>
    </main>
  );
}

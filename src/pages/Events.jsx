import Header from "../components/Header";
import { useEffect, useState, useContext, useCallback } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { useCachedData } from "../hooks/useCachedData";
import { useToast } from "../components/Toast";
import EmptyState from "../components/EmptyState";
import SkeletonLoader from "../components/SkeletonLoader";
import { CalendarPlus } from "lucide-react";
import { useDebounce } from "../hooks/useDebounce";
import { formatEventDate } from "../utils/eventDates";

export default function Events({ onLoaded }) {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", date: "", end_date: "", attendance_points: 2 });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [eventLocation, setEventLocation] = useState({ latitude: null, longitude: null });

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const debouncedSearch = useDebounce(search, 300);

  const fetchEvents = useCallback(() =>
    fetch("/api/events").then((r) => r.json()).then((d) => (Array.isArray(d) ? d : [])),
    []
  );

  const { data: events, loading, fromCache, refresh } = useCachedData("events", fetchEvents);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEventLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoLoading(false);
      },
      (err) => {
        setGeoError("Location access denied. GPS is required for attendance tracking.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date || !file) return;
    if (newEvent.end_date && newEvent.end_date < newEvent.date) {
      toast.error("End date must be on or after the start date.");
      return;
    }

    const fd = new FormData();
    fd.append("title", newEvent.title);
    fd.append("description", newEvent.description);
    fd.append("date", newEvent.date);
    if (newEvent.end_date) fd.append("end_date", newEvent.end_date);
    fd.append("image", file);
    if (eventLocation.latitude != null) fd.append("latitude", eventLocation.latitude);
    if (eventLocation.longitude != null) fd.append("longitude", eventLocation.longitude);
    fd.append("radius", "100");
    if (newEvent.attendance_points) fd.append("attendance_points", newEvent.attendance_points);

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Authorization": `Bearer ${user?.token}` },
        body: fd
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to add event");
      }

      const data = await res.json();
      setNewEvent({ title: "", description: "", date: "", end_date: "", attendance_points: 2 });
      setFile(null);
      setPreview("");
      setEventLocation({ latitude: null, longitude: null });
      setGeoError("");
      setShowModal(false);
      refresh();
    } catch (err) {
      toast.error(err.message || "Failed to add event. Please try again.");
    }
  };

  const filteredEvents = Array.isArray(events)
    ? events.filter((event) => {
        const title = (event.title || "").toLowerCase();
        const matchesSearch = title.includes(debouncedSearch.toLowerCase());

        const eventDate = new Date(event.date);
        const eventEnd = event.end_date ? new Date(event.end_date) : eventDate;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let matchesFilter = true;
        if (activeFilter === "Upcoming") {
          matchesFilter = eventEnd >= today;
        } else if (activeFilter === "Completed") {
          matchesFilter = eventEnd < today;
        } else if (activeFilter === "This Month") {
          matchesFilter =
            (eventDate.getMonth() === today.getMonth() && eventDate.getFullYear() === today.getFullYear()) ||
            (eventEnd.getMonth() === today.getMonth() && eventEnd.getFullYear() === today.getFullYear());
        }

        return matchesSearch && matchesFilter;
      })
    : [];

  if (onLoaded) onLoaded();

  const filterButtons = ["All", "Upcoming", "Completed", "This Month"];

  return (
    <main className="relative w-full h-screen overflow-y-auto overflow-x-hidden">
      <Header />

      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>

      <section className="max-w-6xl mx-auto px-6 pt-32 pb-20">
        <h1 className="text-3xl md:text-4xl font-bold mb-8 md:mb-12 text-center">Events</h1>

        {user?.role === "admin" && (
          <div className="text-center mb-6">
              <button
                onClick={() => { setShowModal(true); detectLocation(); }}
                className="btn-primary flex items-center gap-2 mx-auto"
              >
                <CalendarPlus size={18} />
                Add Event
              </button>
          </div>
        )}

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-premium w-full"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6 justify-center">
          {filterButtons.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeFilter === f
                  ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/30"
                  : "bg-white/10 text-gray-300 border border-white/20 hover:bg-white/20"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {loading && !events ? (
            <div className="col-span-full">
              <SkeletonLoader type="page" />
            </div>
          ) : filteredEvents.length > 0 ? (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-2xl overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 transform translate-y-10 transition-all duration-700 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/30"
              >
                <img
                  src={event.image}
                  className="w-full h-48 object-cover"
                />
                <div className="p-5">
                  <h3 className="text-xl font-bold mb-2">{event.title}</h3>
                  <p className="text-gray-300 mb-1">{formatEventDate(event)}</p>
                  {event.latitude != null && event.longitude != null && (
                    <p className="text-xs text-cyan-400 mb-3 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                      Location set · {event.radius || 100}m radius
                    </p>
                  )}
                  <Link to={`/events/${event.id}`}>
                    <button className="btn-primary w-full">
                      View Details
                    </button>
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyState
                type="events"
                title={fromCache ? "No cached events" : "No events yet"}
                description={fromCache ? "Connect to the internet to load events." : "Events will appear here when created by an admin."}
              />
            </div>
          )}
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 sm:p-8 w-full max-w-md mx-4 relative shadow-xl">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">Add New Event</h2>

            <input
              type="text"
              placeholder="Title"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              className="input-premium mb-3"
            />
            <textarea
              placeholder="Description"
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              className="input-premium mb-3"
              rows={3}
            />
            <input
              type="date"
              value={newEvent.date}
              onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
              className="input-premium mb-3 [color-scheme:dark]"
            />
            <input
              type="date"
              value={newEvent.end_date}
              onChange={(e) => setNewEvent({ ...newEvent, end_date: e.target.value })}
              className="input-premium mb-3 [color-scheme:dark]"
              title="End date (optional) — leave empty for a single-day event"
              placeholder="End date (optional)"
            />
            <p className="text-xs text-gray-400 -mt-2 mb-3">End date optional — leave empty for a single-day event.</p>
            <input
              type="number"
              min="0"
              placeholder="Attendance Points"
              value={newEvent.attendance_points}
              onChange={(e) => setNewEvent({ ...newEvent, attendance_points: parseInt(e.target.value) || 0 })}
              className="input-premium mb-3"
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full mb-3 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-cyan-500 file:text-black file:font-semibold file:cursor-pointer hover:file:bg-cyan-400"
            />
            {preview && (
              <img src={preview} alt="Preview" className="w-full h-40 object-cover rounded-xl mb-4" />
            )}

            <div className="mb-3 p-2 rounded bg-white/10 border border-white/20 text-xs">
              {geoLoading ? (
                <p className="text-cyan-400">Detecting your GPS location...</p>
              ) : eventLocation.latitude != null ? (
                <p className="text-green-400">Location detected: {eventLocation.latitude.toFixed(5)}, {eventLocation.longitude.toFixed(5)}</p>
              ) : geoError ? (
                <p className="text-red-400">{geoError}</p>
              ) : (
                <p className="text-gray-400">Location not detected yet.</p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setShowModal(false); setFile(null); setPreview(""); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddEvent}
                className="btn-primary"
              >
                Add Event
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

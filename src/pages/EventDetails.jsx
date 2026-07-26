import Header from "../components/Header";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Calendar, MapPin, ArrowLeft, Clock, Users, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function EventDetails({ onLoaded }) {
  const { id } = useParams();
  const [event, setEvent] = useState(null);

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then(res => res.json())
      .then(data => setEvent(data))
      .catch(() => {
        const events = [
          { id: 1, title: "Ramadan Bag Collection", date: "2026-03-10", image: "/events/1.jpeg", details: "Ramadan charity event for collecting bags for those in need." },
          { id: 2, title: "Medical Technology Day", date: "2026-05-22", image: "/events/2.jpg", details: "Showcasing latest medical technology innovations." },
          { id: 3, title: "Emergency Training 1", date: "2026-06-10", image: "/events/3.jpg", details: "First aid and evacuation emergency training." },
          { id: 4, title: "Emergency Training 2", date: "2026-06-10", image: "/events/3.jpg", details: "Additional emergency training for new staff." },
        ];
        setEvent(events.find(e => e.id.toString() === id));
      });
  }, [id]);

  if (onLoaded) onLoaded();
  if (!event) return (
    <main className="relative w-full h-screen overflow-y-auto">
      <Header />
      <div className="max-w-4xl mx-auto px-6 pt-32 pb-20">
        <div className="animate-pulse space-y-4">
          <div className="h-64 md:h-96 bg-white/5 rounded-2xl" />
          <div className="h-8 bg-white/10 rounded w-1/3" />
          <div className="h-4 bg-white/10 rounded w-1/4" />
          <div className="h-20 bg-white/5 rounded-xl" />
        </div>
      </div>
    </main>
  );

  return (
    <main className="relative w-full h-screen overflow-y-auto overflow-x-hidden scrollbar-auto-hide">
      <Header />
      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>

      <div className="max-w-4xl mx-auto px-6 pt-28 md:pt-32 pb-20">
        <Link to="/events" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition mb-6">
          <ArrowLeft size={16} />
          Back to Events
        </Link>
        <img
          src={event.image}
          alt={event.title}
          className="w-full h-48 md:h-96 object-cover rounded-2xl mb-6 shadow-lg shadow-cyan-500/20"
        />
        <h1 className="text-2xl md:text-4xl font-bold mb-3">{event.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-6">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} className="text-cyan-400" />
            {event.date?.slice?.(0, 10) || event.date}
          </span>
          {event.latitude != null && event.longitude != null && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-cyan-400" />
              Location set ({event.radius || 100}m radius)
            </span>
          )}
          {event.attendanceCount != null && (
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-cyan-400" />
              {event.attendanceCount} attended
            </span>
          )}
          {event.attendance_points != null && (
            <span className="flex items-center gap-1.5 text-yellow-400 font-semibold">
              ★ {event.attendance_points} pts
            </span>
          )}
        </div>
        <p className="text-gray-300 leading-relaxed text-lg">{event.details || event.description}</p>
        <div className="mt-8 pt-6 border-t border-white/10 flex gap-3">
          <Link to="/events" className="btn-secondary flex items-center gap-2">
            <ArrowLeft size={16} /> Back to Events
          </Link>
          <Link to="/gallery" className="btn-primary flex items-center gap-2">
            View Gallery <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </main>
  );
}
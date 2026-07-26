import { useState, useEffect, useContext } from "react";
import Header from "../components/Header";
import { AuthContext } from "../context/AuthContext";
import axios from "../utils/axios";
import { useToast } from "../components/Toast";
import EmptyState from "../components/EmptyState";
import { Download } from "lucide-react";

export default function Attendance() {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const [attendance, setAttendance] = useState([]);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 15;

  useEffect(() => {
    if (!user?.token) return;
    axios
      .get("/api/attendance/all", {
        headers: { Authorization: `Bearer ${user.token}` },
      })
      .then((res) => setAttendance(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [user?.token]);

  const uniqueEvents = [...new Set((attendance || []).map(a => a.eventTitle || a.title).filter(Boolean))];

  const filtered = (attendance || []).filter(a =>
    ((a.memberName || a.name || "").toLowerCase().includes(search.toLowerCase()) ||
     (a.eventTitle || a.title || "").toLowerCase().includes(search.toLowerCase())) &&
    (!eventFilter || (a.eventTitle || a.title) === eventFilter)
  );

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const lockEvent = (eventId) => {
    axios
      .post(
        `/api/events/${eventId}/lock`,
        {},
        { headers: { Authorization: `Bearer ${user.token}` } }
      )
      .then(() => toast.success("Event locked successfully"))
      .catch(() => toast.error("Failed to lock event"));
  };

  const exportCSV = () => {
    const csv = [
      ["Member Name", "Event Title", "Date", "Time"],
      ...(Array.isArray(attendance) ? attendance.map((a) => [a.memberName || a.name, a.eventTitle || a.title, a.date || "", a.time || ""]) : []),
    ]
      .map((e) => e.join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "attendance.csv";
    link.click();
  };

  return (
    <main className="relative w-full h-screen overflow-y-auto overflow-x-hidden">
      <Header />
      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>

      <div className="p-4 sm:p-8 pt-32 max-w-5xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold mb-4">Attendance Management</h2>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by Member or Event"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-premium"
            aria-label="Search attendance records"
          />
          <select value={eventFilter} onChange={e => { setEventFilter(e.target.value); setCurrentPage(1); }}
            className="input-premium max-w-xs">
            <option value="">All Events</option>
            {uniqueEvents.map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </select>
          <button onClick={exportCSV} className="btn-primary flex items-center gap-2" aria-label="Export attendance as CSV">
            <Download size={16} />
            Export CSV
          </button>
        </div>

        {filtered.length === 0 && (
          <EmptyState type="attendance" title="No records found" description={search || eventFilter ? "Try adjusting your filters." : "No attendance records yet."} />
        )}

        <div className="overflow-x-auto rounded-lg border border-white/20">
        <table className="min-w-full border border-white/20">
          <thead>
            <tr className="bg-white/10">
              <th className="p-2">Member Name</th>
              <th className="p-2">Event Title</th>
              <th className="p-2">Date</th>
              <th className="p-2">Time</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(paginated) && paginated.map((a) => (
              <tr key={a.id} className="border-t border-white/10">
                <td className="p-2">{a.memberName || a.name}</td>
                <td className="p-2">{a.eventTitle || a.title}</td>
                <td className="p-2">{a.date ? new Date(a.date).toLocaleDateString() : (a.timestamp ? new Date(a.timestamp).toLocaleDateString() : "")}</td>
                <td className="p-2">{a.time || (a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : "")}</td>
                <td className="p-2">
                  <button onClick={() => lockEvent(a.eventId)} className="btn-danger btn-sm">
                    Lock Event
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-400">
              Showing {(currentPage - 1) * PER_PAGE + 1}–{Math.min(currentPage * PER_PAGE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn-secondary btn-sm">Prev</button>
              <span className="text-sm text-gray-400 px-3 py-1">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

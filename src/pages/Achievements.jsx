import { useState } from "react";
import { useDebounce } from "../hooks/useDebounce";
import Header from "../components/Header";
import EmptyState from "../components/EmptyState";

export default function Achievements() {
  const [achievements] = useState([
    { id: 1, title: "First Place Hackathon", description: "MT Club achieved first place in the university hackathon.", image: "/gradient.png", date: "March 2025" },
    { id: 2, title: "Community Service Award", description: "Recognized for outstanding community service initiatives.", image: "/gradient.png", date: "January 2026" },
  ]);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const filtered = achievements.filter(a =>
    a.title.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
    a.description.toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  return (
    <main className="relative w-full h-screen overflow-y-auto overflow-x-hidden">
      <Header />
      <img className="absolute top-0 right-0 opacity-60 -z-10" src="/gradient.png" />
      <div className="h-0 w-[40rem] absolute top-[20%] right-[-5%] shadow-[0_0_900px_20px_#00ACC1] -rotate-[30deg] -z-10"></div>

      <div className="px-6 lg:px-20 py-32">
        <h1 className="text-3xl md:text-4xl font-light mb-8 md:mb-12">Achievements</h1>
        <input
          type="text"
          placeholder="Search achievements..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-premium mb-6 max-w-md"
        />
        {filtered.length === 0 ? (
          <EmptyState type="events" title="No achievements yet" description={search ? "No achievements match your search." : "Achievements will appear here as the club reaches new milestones."} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((a) => (
              <div key={a.id} className="card-hover bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden">
                <img src={a.image} className="w-full h-48 object-cover opacity-80" alt={a.title} />
                <div className="p-6">
                  <h2 className="text-xl mb-2">{a.title}</h2>
                  <p className="text-gray-400 text-sm">{a.description}</p>
                  <span className="block mt-4 text-xs text-gray-500">{a.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

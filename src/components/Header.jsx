import { useContext } from "react";
import { Link } from "react-router-dom";
import { Star, LogOut } from "lucide-react";
import NeonButton from "./NeonButton";
import { AuthContext } from "../context/AuthContext";

export default function Header() {
  const { user, openAuth, logout } = useContext(AuthContext);

  const isAdmin = user?.role === "admin";
  const isLeader = user?.role === "leader";
  const canAccessAdmin = isAdmin || isLeader;

  return (
    <header className="flex justify-between items-center py-4 px-4 lg:px-20 relative z-50" role="banner">
      <Link to="/" className="text-3xl md:text-5xl font-light flicker-hover" style={{ color: "var(--text-primary)" }} aria-label="MT Club Home">
        MT CLUB
      </Link>

      <nav className="hidden lg:flex gap-12" style={{ color: "var(--text-primary)" }} role="navigation" aria-label="Main navigation">
        <Link to="/team" className="flicker-hover">Team</Link>
        <Link to="/events" className="flicker-hover">Events</Link>
        <Link to="/gallery" className="flicker-hover">Gallery</Link>
        <Link to="/scan" className="flicker-hover">Attendance</Link>
        {canAccessAdmin && <Link to="/admin" className="flicker-hover font-bold" style={{ color: "#06b6d4" }}>Admin Panel</Link>}
      </nav>

      <div className="hidden lg:flex items-center gap-3">
        {!user ? (
          <NeonButton onClick={openAuth}>Sign In</NeonButton>
        ) : (
          <div className="flex items-center gap-3">
            <Link to="/profile" className="flex items-center gap-2" aria-label={`Profile: ${user.name || user.email}`}>
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#a7a7a7] flex items-center justify-center flex-shrink-0">
                {user.profile_image ? (
                  <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <i className="bx bx-user text-black text-xl" aria-hidden="true"></i>
                )}
              </div>
              <div className="text-right">
                <span className="block text-sm leading-tight" style={{ color: "var(--text-primary)" }}>{user.name || user.email}</span>
                <span className="text-[10px] text-cyan-400 uppercase tracking-wider">{user.role}</span>
              </div>
            </Link>
            <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 py-1.5">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">{user.points ?? 0}</span>
            </div>
            <button onClick={logout} className="bg-red-500 flicker-hover border-none text-white py-2 px-4 rounded-full text-sm" aria-label="Logout">Logout</button>
          </div>
        )}
      </div>

      <div className="lg:hidden flex items-center gap-2">
        {user && (
          <>
            <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 py-1.5">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-bold text-yellow-400">{user.points ?? 0}</span>
            </div>
            <button onClick={logout} className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors hover:bg-red-500/10 text-red-400" aria-label="Logout">
              <LogOut size={20} />
            </button>
          </>
        )}
      </div>
    </header>
  );
}

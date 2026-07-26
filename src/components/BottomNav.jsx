import { useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, Calendar, ScanLine, Users, User, ShieldCheck } from "lucide-react";
import { AuthContext } from "../context/AuthContext";

const tabs = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Events", icon: Calendar, path: "/events" },
  { label: "Attendance", icon: ScanLine, path: "/scan" },
  { label: "Team", icon: Users, path: "/team" },
  { label: "Profile", icon: User, path: "/profile" },
];

const adminTab = { label: "Admin", icon: ShieldCheck, path: "/admin" };

export default function BottomNav() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const canAccessAdmin = user?.role === "admin" || user?.role === "leader";
  const allTabs = canAccessAdmin ? [...tabs, adminTab] : tabs;

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      role="navigation"
      aria-label="Mobile navigation"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        className="flex items-center justify-around mx-2 mb-2 rounded-2xl border border-white/10"
        style={{
          background: "rgba(10, 10, 10, 0.7)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 -1px 0 0 rgba(6, 182, 212, 0.15), 0 4px 24px rgba(0, 0, 0, 0.4)",
        }}
      >
        {allTabs.map((tab) => {
          const active = isActive(tab.path);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[52px] transition-all duration-200 ${
                active ? "text-cyan-400" : "text-gray-500"
              }`}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
              role="tab"
            >
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.8}
                className={`transition-all duration-200 ${
                  active ? "drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]" : ""
                }`}
              />
              <span className={`text-[10px] leading-tight transition-all duration-200 ${
                active ? "font-semibold" : "font-medium"
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

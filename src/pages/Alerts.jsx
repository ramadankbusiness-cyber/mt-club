import { useContext, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import SkeletonLoader from "../components/SkeletonLoader";

const NotificationInbox = lazy(() => import("../components/NotificationInbox"));

export default function Alerts() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <p className="text-gray-400 text-sm">Please log in to view notifications.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    }>
      <NotificationInbox user={user} onBack={() => navigate(-1)} />
    </Suspense>
  );
}

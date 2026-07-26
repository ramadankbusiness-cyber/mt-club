import { useContext, useState, useCallback, Suspense, lazy } from "react";
import { Route } from "react-router-dom";

import { AuthProvider, AuthContext } from "./context/AuthContext";
import { NetworkProvider } from "./context/NetworkContext";
import { ToastProvider } from "./components/Toast";
import LoadingScreen from "./components/LoadingScreen";
import PageTransition from "./components/PageTransition";
import BottomNav from "./components/BottomNav";
import OfflineBanner from "./components/OfflineBanner";
import ErrorBoundary from "./components/ErrorBoundary";
import SkeletonLoader from "./components/SkeletonLoader";
import ProtectedRoute from "./components/ProtectedRoute";
import { useNativeInit } from "./hooks/useNativeInit";
import { useNotifications } from "./hooks/useNotifications";

const Home = lazy(() => import("./pages/Home"));
const Events = lazy(() => import("./pages/Events"));
const EventDetails = lazy(() => import("./pages/EventDetails"));
const Profile = lazy(() => import("./pages/Profile"));
const TeamPage = lazy(() => import("./pages/Team"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Achievements = lazy(() => import("./pages/Achievements"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminAccounts = lazy(() => import("./pages/AdminAccounts"));
const QRCodePage = lazy(() => import("./pages/QRCode"));
const Attendance = lazy(() => import("./pages/Attendance"));
const ScanAttendance = lazy(() => import("./pages/scanAttendance"));
const AuthModal = lazy(() => import("./components/authmodal"));

function AppFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <SkeletonLoader type="page" />
      </div>
    </div>
  );
}

function AppContent() {
  const { showAuth } = useContext(AuthContext);
  const [loaded, setLoaded] = useState(false);
  const handleLoaded = useCallback(() => setLoaded(true), []);
  useNativeInit();

  const { user } = useContext(AuthContext);
  useNotifications(user);

  return (
    <ErrorBoundary>
      <LoadingScreen onComplete={handleLoaded} />
      <OfflineBanner />

      <div className={loaded ? "app-content-enter" : "opacity-0"}>
        <Suspense fallback={<AppFallback />}>
          <PageTransition>
            <Route path="/" element={<Home />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetails />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/scan" element={<ScanAttendance />} />
            <Route path="/admin" element={
              <ProtectedRoute roles={["admin", "leader"]}>
                <AdminPanel />
              </ProtectedRoute>
            } />
            <Route path="/admin/accounts" element={
              <ProtectedRoute roles={["admin"]}>
                <AdminAccounts />
              </ProtectedRoute>
            } />
            <Route path="/admin/qr-code" element={
              <ProtectedRoute roles={["admin"]}>
                <QRCodePage />
              </ProtectedRoute>
            } />
          </PageTransition>
        </Suspense>

        {showAuth && (
          <Suspense fallback={null}>
            <AuthModal />
          </Suspense>
        )}
      </div>

      <BottomNav />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NetworkProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </NetworkProvider>
    </AuthProvider>
  );
}

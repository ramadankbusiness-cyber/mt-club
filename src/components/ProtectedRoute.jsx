import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import LoadingPage from "./LoadingPage";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <LoadingPage />;
  if (!user) return <Navigate to="/" />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" />;
  }

  return children;
}

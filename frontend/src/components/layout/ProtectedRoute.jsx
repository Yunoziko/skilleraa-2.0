import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading || user === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-white" data-testid="auth-loading">
        <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user === false) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === "client" ? "/client" : "/student"} replace />;
  }

  return children;
}

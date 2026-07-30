import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * While auth is paused (Supabase placeholders), allow dashboard routes so the
 * Applications module can be exercised with local mock storage.
 * When real Supabase keys are set, normal auth gating applies unchanged.
 */
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const offlineDemo = !isSupabaseConfigured;

  if (loading || user === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-white" data-testid="auth-loading">
        <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user === false) {
    if (offlineDemo) {
      return children;
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === "client" ? "/client" : "/student"} replace />;
  }

  return children;
}

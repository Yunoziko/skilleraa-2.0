import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Requires a Supabase session. Unauthenticated users are sent to /login.
 * Optional `role`: "student" | "client".
 * Optional `adminDemo`: requires REACT_APP_ENABLE_ADMIN_DEMO=true (mock admin only).
 */
export default function ProtectedRoute({ children, role, adminDemo = false }) {
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

  if (adminDemo && process.env.REACT_APP_ENABLE_ADMIN_DEMO !== "true") {
    return <Navigate to="/" replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === "client" ? "/client" : "/student"} replace />;
  }

  return children;
}

/** Safe post-login destination that respects role boundaries. */
export function safePostLoginPath(from, role) {
  const home = role === "client" ? "/client" : "/student";
  if (!from || typeof from !== "string" || !from.startsWith("/")) return home;
  if (from.startsWith("/login") || from.startsWith("/signup") || from.startsWith("/auth")) return home;
  if (from.startsWith("/admin")) return home;
  if (role === "student" && from.startsWith("/client")) return home;
  if (role === "client" && from.startsWith("/student")) return home;
  return from;
}

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Requires a Supabase session. Unauthenticated users are sent to /login.
 * Optional `role`: "student" | "client" | "admin".
 */
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
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (user.role === "client") return <Navigate to="/client" replace />;
    if (user.role === "student") return <Navigate to="/student" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}

function roleHome(role) {
  if (role === "admin") return "/admin";
  if (role === "client") return "/client";
  return "/student";
}

/** Safe post-login destination that respects role boundaries. */
export function safePostLoginPath(from, role) {
  const home = roleHome(role);
  if (!from || typeof from !== "string" || !from.startsWith("/")) return home;
  if (from.startsWith("/login") || from.startsWith("/signup") || from.startsWith("/auth")) return home;
  if (role === "admin") return from.startsWith("/admin") ? from : home;
  if (from.startsWith("/admin")) return home;
  if (role === "student" && from.startsWith("/client")) return home;
  if (role === "client" && from.startsWith("/student")) return home;
  return from;
}

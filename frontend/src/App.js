import { useEffect, useRef, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import About from "@/pages/About";
import NotFound from "@/pages/NotFound";
import PublicProfile from "@/pages/PublicProfile";
import Notifications from "@/pages/Notifications";
import Messages from "@/pages/Messages";
import Settings from "@/pages/Settings";

import StudentDashboard from "@/pages/student/StudentDashboard";
import AppliedJobs from "@/pages/student/AppliedJobs";
import SavedJobs from "@/pages/student/SavedJobs";
import StudentProfile from "@/pages/student/StudentProfile";
import StudentProfileEdit from "@/pages/student/StudentProfileEdit";
import StudentReviews from "@/pages/student/StudentReviews";
import StudentProjects from "@/pages/student/StudentProjects";
import Wallet from "@/pages/student/Wallet";

import ClientDashboard from "@/pages/client/ClientDashboard";
import PostJob from "@/pages/client/PostJob";
import MyJobs from "@/pages/client/MyJobs";
import Applicants from "@/pages/client/Applicants";
import ClientProfile from "@/pages/client/ClientProfile";
import ClientProfileEdit from "@/pages/client/ClientProfileEdit";
import ClientReviews from "@/pages/client/ClientReviews";
import ClientOrders from "@/pages/client/ClientOrders";
import ProjectDetail from "@/pages/ProjectDetail";

import AdminOverview from "@/pages/admin/AdminOverview";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminJobs from "@/pages/admin/AdminJobs";
import AdminReports from "@/pages/admin/AdminReports";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminSettings from "@/pages/admin/AdminSettings";

function AuthCallback() {
  const { handleAuthCallback } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState("");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return undefined;
    ranRef.current = true;

    let cancelled = false;
    (async () => {
      const res = await handleAuthCallback();
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error || "Authentication failed");
        return;
      }
      const role = res.user?.role || "student";
      nav(role === "client" ? "/client" : "/student", { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [handleAuthCallback, nav]);

  if (error) {
    return (
      <div className="min-h-screen grid place-items-center bg-white px-6" data-testid="auth-callback-error">
        <div className="text-center space-y-4">
          <p className="text-sm text-neutral-700">{error}</p>
          <button
            type="button"
            onClick={() => nav("/login", { replace: true })}
            className="text-sm underline underline-offset-4"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-white" data-testid="auth-callback-loading">
      <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function PostJobGate() {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user === false) {
    return <Navigate to="/login" state={{ from: "/post-job" }} replace />;
  }
  if (user.role === "client") return <Navigate to="/client/post" replace />;
  return <Navigate to="/student" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" />
      <div className="App">
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/u/:id" element={<PublicProfile />} />
            <Route path="/post-job" element={<PostJobGate />} />

            {/* Student */}
            <Route
              path="/student"
              element={
                <ProtectedRoute role="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/applied"
              element={
                <ProtectedRoute role="student">
                  <AppliedJobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/saved"
              element={
                <ProtectedRoute role="student">
                  <SavedJobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/profile"
              element={
                <ProtectedRoute role="student">
                  <StudentProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/profile/edit"
              element={
                <ProtectedRoute role="student">
                  <StudentProfileEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:id"
              element={
                <ProtectedRoute>
                  <ProjectDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/reviews"
              element={
                <ProtectedRoute role="student">
                  <StudentReviews />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/notifications"
              element={
                <ProtectedRoute role="student">
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/projects"
              element={
                <ProtectedRoute role="student">
                  <StudentProjects />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/wallet"
              element={
                <ProtectedRoute role="student">
                  <Wallet />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/messages"
              element={
                <ProtectedRoute role="student">
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/settings"
              element={
                <ProtectedRoute role="student">
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Client */}
            <Route
              path="/client"
              element={
                <ProtectedRoute role="client">
                  <ClientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/post"
              element={
                <ProtectedRoute role="client">
                  <PostJob />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/jobs"
              element={
                <ProtectedRoute role="client">
                  <MyJobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/applicants"
              element={
                <ProtectedRoute role="client">
                  <Applicants />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/profile"
              element={
                <ProtectedRoute role="client">
                  <ClientProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/profile/edit"
              element={
                <ProtectedRoute role="client">
                  <ClientProfileEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/orders"
              element={
                <ProtectedRoute role="client">
                  <ClientOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/reviews"
              element={
                <ProtectedRoute role="client">
                  <ClientReviews />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/messages"
              element={
                <ProtectedRoute role="client">
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/notifications"
              element={
                <ProtectedRoute role="client">
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/client/settings"
              element={
                <ProtectedRoute role="client">
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Admin demo — disabled unless REACT_APP_ENABLE_ADMIN_DEMO=true */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminDemo>
                  <AdminOverview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute adminDemo>
                  <AdminUsers />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/jobs"
              element={
                <ProtectedRoute adminDemo>
                  <AdminJobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute adminDemo>
                  <AdminReports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute adminDemo>
                  <AdminAnalytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute adminDemo>
                  <AdminSettings />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;

import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/layout/ProtectedRoute";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import About from "@/pages/About";
import NotFound from "@/pages/NotFound";
import PublicProfile from "@/pages/PublicProfile";
import Notifications from "@/pages/Notifications";
import Settings from "@/pages/Settings";

import StudentDashboard from "@/pages/student/StudentDashboard";
import AppliedJobs from "@/pages/student/AppliedJobs";
import SavedJobs from "@/pages/student/SavedJobs";
import StudentProfile from "@/pages/student/StudentProfile";

import ClientDashboard from "@/pages/client/ClientDashboard";
import PostJob from "@/pages/client/PostJob";
import MyJobs from "@/pages/client/MyJobs";
import Applicants from "@/pages/client/Applicants";
import ClientProfile from "@/pages/client/ClientProfile";

function PostJobGate() {
  const { user, loading } = useAuth();
  if (loading || user === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user === false) return <Navigate to="/signup" replace />;
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
              path="/student/notifications"
              element={
                <ProtectedRoute role="student">
                  <Notifications />
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
              path="/client/messages"
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

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

export default App;

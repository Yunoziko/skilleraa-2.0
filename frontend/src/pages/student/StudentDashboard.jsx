import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Bookmark, FileText, CheckCircle2, Sparkles } from "lucide-react";
import DashboardShell from "@/components/layout/DashboardShell";
import JobCard from "@/components/JobCard";
import AiMatches from "@/components/AiMatches";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ applications: 0, saved: 0, shortlisted: 0, hired: 0, profile_completion: 0 });
  const [applications, setApplications] = useState([]);
  const [recommended, setRecommended] = useState([]);

  useEffect(() => {
    api.get("/dashboard/student").then((r) => setStats(r.data)).catch(() => {});
    api.get("/applications/mine").then((r) => setApplications(r.data.slice(0, 4))).catch(() => {});
    api.get("/jobs").then((r) => setRecommended(r.data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <DashboardShell title={`Welcome, ${user?.name?.split(" ")[0] || "there"}`}>
      {/* Welcome card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-black text-white p-8 md:p-10 relative overflow-hidden"
        data-testid="welcome-card"
      >
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }} aria-hidden />
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-semibold">Your journey</div>
            <h2 className="mt-2 font-display text-3xl md:text-4xl tracking-tighter font-medium max-w-md">
              Ready to earn something real today?
            </h2>
            <div className="mt-5 text-sm text-neutral-300">
              Profile completion · <span className="text-white font-medium">{stats.profile_completion}%</span>
            </div>
            <div className="mt-2 h-1.5 w-56 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.profile_completion}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full bg-white"
              />
            </div>
          </div>
          <Link
            to="/jobs"
            className="inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white/90 active:scale-95 transition"
            data-testid="dashboard-browse-jobs"
          >
            Browse Jobs <ArrowUpRight size={14} />
          </Link>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={FileText} label="Applied" value={stats.applications} />
        <StatCard icon={Bookmark} label="Saved" value={stats.saved} />
        <StatCard icon={Sparkles} label="Shortlisted" value={stats.shortlisted} />
        <StatCard icon={CheckCircle2} label="Hired" value={stats.hired} />
      </div>

      {/* AI matching */}
      <div className="mt-6">
        <AiMatches />
      </div>

      {/* Two-col */}
      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <div className="border skl-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Recent Applications</h3>
            <Link to="/student/applied" className="text-xs text-neutral-500 hover:text-black">View all</Link>
          </div>
          <div className="mt-4 space-y-2">
            {applications.length === 0 ? (
              <p className="text-sm text-neutral-500">No applications yet. Browse jobs to start applying.</p>
            ) : (
              applications.map((a) => (
                <Link
                  key={a.id}
                  to={a.job ? `/jobs/${a.job.id}` : "#"}
                  className="flex items-center justify-between p-3 rounded-xl border skl-border hover:bg-neutral-50 transition"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.job?.title || "Removed job"}</div>
                    <div className="text-xs text-neutral-500 truncate">{a.job?.company_name}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                    {a.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="border skl-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Complete your profile</h3>
            <Link to="/student/profile" className="text-xs text-neutral-500 hover:text-black">Edit</Link>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              ["Add a headline", user?.headline],
              ["Write a short bio", user?.bio],
              ["Add skills", user?.skills?.length],
              ["Set your location", user?.location],
              ["Add portfolio URL", user?.portfolio_url],
              ["Add education", user?.education],
            ].map(([label, done]) => (
              <li key={label} className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50">
                <div className={`h-4 w-4 rounded-full border grid place-items-center ${done ? "bg-black border-black" : "border-neutral-300"}`}>
                  {done ? <CheckCircle2 size={10} className="text-white" /> : null}
                </div>
                <span className={done ? "line-through text-neutral-400" : ""}>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommended jobs */}
      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold">Recommended for you</h3>
          <Link to="/jobs" className="text-xs text-neutral-500 hover:text-black">See more</Link>
        </div>
        <div className="mt-5 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommended.map((j, i) => (
            <JobCard key={j.id} job={j} index={i} />
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="border skl-border rounded-2xl p-5" data-testid={`stat-${label.toLowerCase()}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">{label}</div>
        <Icon size={14} className="text-neutral-400" />
      </div>
      <div className="mt-3 font-display text-3xl tracking-tighter font-medium">{value}</div>
    </div>
  );
}

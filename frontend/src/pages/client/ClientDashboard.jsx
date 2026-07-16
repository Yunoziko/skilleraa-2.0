import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, Users, CheckCircle2, ArrowUpRight, PlusSquare } from "lucide-react";
import DashboardShell from "@/components/layout/DashboardShell";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function ClientDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total_jobs: 0, open_jobs: 0, applications: 0, hired: 0 });
  const [jobs, setJobs] = useState([]);
  const [apps, setApps] = useState([]);

  useEffect(() => {
    api.get("/dashboard/client").then((r) => setStats(r.data)).catch(() => {});
    api.get("/jobs/mine").then((r) => setJobs(r.data.slice(0, 4))).catch(() => {});
    api.get("/applicants/all").then((r) => setApps(r.data.slice(0, 5))).catch(() => {});
  }, []);

  return (
    <DashboardShell
      title={`Welcome, ${user?.name?.split(" ")[0] || "there"}`}
      actions={
        <Link
          to="/client/post"
          className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-black/90 active:scale-95 transition"
          data-testid="dashboard-post-job"
        >
          <PlusSquare size={14} /> Post Job
        </Link>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <StatCard icon={Briefcase} label="Total Jobs" value={stats.total_jobs} />
        <StatCard icon={ArrowUpRight} label="Open" value={stats.open_jobs} />
        <StatCard icon={Users} label="Applications" value={stats.applications} />
        <StatCard icon={CheckCircle2} label="Hired" value={stats.hired} />
      </motion.div>

      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <div className="border skl-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Your latest jobs</h3>
            <Link to="/client/jobs" className="text-xs text-neutral-500 hover:text-black">View all</Link>
          </div>
          <div className="mt-4 space-y-2">
            {jobs.length === 0 ? (
              <p className="text-sm text-neutral-500">You haven't posted any jobs yet.</p>
            ) : (
              jobs.map((j) => (
                <Link
                  key={j.id}
                  to={`/jobs/${j.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border skl-border hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{j.title}</div>
                    <div className="text-xs text-neutral-500">{j.applications_count || 0} applicants · {j.category}</div>
                  </div>
                  <ArrowUpRight size={14} className="text-neutral-400" />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="border skl-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Recent activity</h3>
            <Link to="/client/applicants" className="text-xs text-neutral-500 hover:text-black">See all</Link>
          </div>
          <div className="mt-4 space-y-2">
            {apps.length === 0 ? (
              <p className="text-sm text-neutral-500">No applications yet. Post a job to get started.</p>
            ) : (
              apps.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border skl-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-black text-white grid place-items-center font-display text-sm font-semibold">
                      {a.student?.avatar_letter || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.student?.name}</div>
                      <div className="text-xs text-neutral-500 truncate">applied to {a.job?.title}</div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full shrink-0">
                    {a.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="border skl-border rounded-2xl p-5" data-testid={`client-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">{label}</div>
        <Icon size={14} className="text-neutral-400" />
      </div>
      <div className="mt-3 font-display text-3xl tracking-tighter font-medium">{value}</div>
    </div>
  );
}

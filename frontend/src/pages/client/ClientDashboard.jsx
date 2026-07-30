import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Briefcase, Users, CheckCircle2, ArrowUpRight, PlusSquare, Lock } from "lucide-react";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import JobStatusBadge from "@/components/JobStatusBadge";
import { ListRowSkeleton, StatSkeletonGrid } from "@/components/Skeleton";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { btnGhost, btnPrimary } from "@/lib/uiClasses";
import {
  displayApplicationStatus,
  listMockApplicants,
  mockClientApplicationStats,
  subscribeApplications,
} from "@/lib/mockApplications";
import {
  listMockClientJobs,
  mockClientJobStats,
  subscribeJobs,
} from "@/lib/mockJobsStore";

export default function ClientDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total_jobs: 0,
    open_jobs: 0,
    closed_jobs: 0,
    applications: 0,
    hired: 0,
  });
  const [jobs, setJobs] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const applyJobs = (list) => {
    setJobs(list.slice(0, 4));
    const closed = list.filter((j) =>
      ["closed", "cancelled", "completed"].includes((j.status || "").toLowerCase())
    ).length;
    setStats((prev) => ({
      ...prev,
      total_jobs: list.length,
      open_jobs: list.filter((j) => (j.status || "open") === "open").length,
      closed_jobs: closed,
    }));
  };

  const loadJobs = () =>
    api
      .get("/jobs/mine")
      .then((r) => {
        applyJobs(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        const list = listMockClientJobs();
        setJobs(list.slice(0, 4));
        const js = mockClientJobStats(list);
        const as_ = mockClientApplicationStats();
        setStats((prev) => ({
          ...prev,
          ...js,
          applications: as_.applications,
          hired: as_.hired,
        }));
      });

  const loadApps = () =>
    api
      .get("/applicants/all")
      .then((r) => {
        const remote = Array.isArray(r.data) ? r.data : [];
        const local = listMockApplicants();
        const remoteIds = new Set(remote.map((a) => a.id));
        const merged = [...remote, ...local.filter((a) => !remoteIds.has(a.id))];
        setApps(merged.slice(0, 5));
        setStats((prev) => ({
          ...prev,
          applications:
            merged.filter((a) => displayApplicationStatus(a.status) === "Pending").length ||
            merged.length,
        }));
      })
      .catch(() => {
        const local = listMockApplicants();
        setApps(local.slice(0, 5));
        const s = mockClientApplicationStats();
        setStats((prev) => ({
          ...prev,
          applications: local.filter((a) => displayApplicationStatus(a.status) === "Pending").length,
          hired: s.hired,
        }));
      });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const dash = api
      .get("/dashboard/client")
      .then((r) => {
        if (cancelled) return;
        setStats((prev) => ({
          ...prev,
          ...r.data,
          closed_jobs: prev.closed_jobs || 0,
        }));
      })
      .catch(() => {});

    Promise.allSettled([dash, loadJobs(), loadApps()]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    const unsubA = subscribeApplications(loadApps);
    const unsubJ = subscribeJobs(loadJobs);
    return () => {
      cancelled = true;
      unsubA();
      unsubJ();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeApplicants = apps.filter((a) => displayApplicationStatus(a.status) === "Pending").length;

  return (
    <DashboardShell
      title={`Welcome, ${user?.name?.split(" ")[0] || "there"}`}
      actions={
        <Link to="/client/post" className={btnPrimary} data-testid="dashboard-post-job">
          <PlusSquare size={14} aria-hidden /> Post Job
        </Link>
      }
    >
      {loading ? (
        <StatSkeletonGrid count={4} />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
        >
          <StatCard icon={Briefcase} label="Total Jobs" value={stats.total_jobs} />
          <StatCard icon={ArrowUpRight} label="Open" value={stats.open_jobs} />
          <StatCard icon={Lock} label="Closed" value={stats.closed_jobs || 0} />
          <StatCard
            icon={Users}
            label="Active Applicants"
            value={activeApplicants || stats.applications || 0}
          />
        </motion.div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/client/post" className={btnPrimary.replace("px-5 py-2.5 text-sm", "px-4 py-2 text-xs")}>
          Post a job
        </Link>
        <Link to="/client/jobs" className={btnGhost}>
          Manage jobs
        </Link>
        <Link to="/client/applicants" className={btnGhost}>
          Review applicants
        </Link>
        <Link to="/jobs" className={btnGhost}>
          Browse marketplace
        </Link>
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <div className="border skl-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Your latest jobs</h3>
            <Link to="/client/jobs" className="text-xs text-neutral-500 hover:text-black">View all</Link>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? (
              <ListRowSkeleton count={3} />
            ) : jobs.length === 0 ? (
              <EmptyState
                title="No jobs yet"
                description="Post your first job to start hiring."
                ctaLabel="Post Job"
                ctaTo="/client/post"
                icon={Briefcase}
                compact
              />
            ) : (
              jobs.map((j) => (
                <Link
                  key={j.id}
                  to={`/jobs/${j.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border skl-border hover:bg-neutral-50"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      <span className="truncate">{j.title}</span>
                      <JobStatusBadge status={j.status} />
                    </div>
                    <div className="text-xs text-neutral-500">{j.applications_count || 0} applicants · {j.category}</div>
                  </div>
                  <ArrowUpRight size={14} className="text-neutral-400 shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="border skl-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">View Applicants</h3>
            <Link to="/client/applicants" className="text-xs text-neutral-500 hover:text-black">See all</Link>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? (
              <ListRowSkeleton count={3} />
            ) : apps.length === 0 ? (
              <EmptyState
                title="No applicants yet"
                description="When students apply, they'll show up here."
                ctaLabel="Browse Jobs"
                ctaTo="/jobs"
                icon={Users}
                compact
              />
            ) : (
              apps.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border skl-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-black text-white grid place-items-center font-display text-sm font-semibold">
                      {a.student?.avatar_letter || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.student?.name}</div>
                      <div className="text-xs text-neutral-500 truncate">
                        applied to {a.job?.title}
                        {a.created_at ? ` · ${new Date(a.created_at).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full shrink-0">
                    {displayApplicationStatus(a.status)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
        <CheckCircle2 size={12} />
        Hired / accepted applications: {stats.hired || 0}
      </div>
    </DashboardShell>
  );
}

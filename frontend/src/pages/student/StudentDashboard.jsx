import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Bookmark, FileText, CheckCircle2, Sparkles } from "lucide-react";
import DashboardShell from "@/components/layout/DashboardShell";
import JobCard from "@/components/JobCard";
import AiMatches from "@/components/AiMatches";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { JobCardSkeletonGrid, ListRowSkeleton, StatSkeletonGrid } from "@/components/Skeleton";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  displayApplicationStatus,
  listMyMockApplications,
  mockStudentApplicationStats,
  resolveApplicantStudent,
  subscribeApplications,
} from "@/lib/mockApplications";
import {
  listMockSavedJobs,
  listMockSavedIds,
  subscribeSavedJobs,
  toggleMockSave,
} from "@/lib/mockSavedJobs";
import { fetchJobs } from "@/lib/jobsService";

export default function StudentDashboard() {
  const { user } = useAuth();
  const student = resolveApplicantStudent(user);
  const [stats, setStats] = useState({ applications: 0, saved: 0, shortlisted: 0, hired: 0, profile_completion: 0 });
  const [applications, setApplications] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [savedJobs, setSavedJobs] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const loadApplications = () =>
    api
      .get("/applications/mine")
      .then((r) => {
        const remote = Array.isArray(r.data) ? r.data : [];
        const local = listMyMockApplications(student.id);
        const remoteIds = new Set(remote.map((a) => a.id));
        const merged = [...remote, ...local.filter((a) => !remoteIds.has(a.id))];
        setApplications(merged.slice(0, 4));
        if (remote.length === 0 && local.length > 0) {
          const s = mockStudentApplicationStats(student.id);
          setStats((prev) => ({
            ...prev,
            applications: s.applications,
            shortlisted: s.accepted,
            hired: s.accepted,
          }));
        }
      })
      .catch(() => {
        const local = listMyMockApplications(student.id);
        setApplications(local.slice(0, 4));
        const s = mockStudentApplicationStats(student.id);
        setStats((prev) => ({
          ...prev,
          applications: s.applications,
          shortlisted: s.accepted,
          hired: s.accepted,
        }));
      });

  const loadSaved = () => {
    const localJobs = listMockSavedJobs();
    const localIds = listMockSavedIds();
    return api
      .get("/jobs/saved/list")
      .then((r) => {
        const remote = Array.isArray(r.data) ? r.data : [];
        const remoteIds = new Set(remote.map((j) => j.id));
        const merged = [...remote, ...localJobs.filter((j) => !remoteIds.has(j.id))];
        setSavedJobs(merged.slice(0, 3));
        setSavedIds(new Set([...remote.map((j) => j.id), ...localIds]));
        setStats((prev) => ({ ...prev, saved: merged.length }));
      })
      .catch(() => {
        setSavedJobs(localJobs.slice(0, 3));
        setSavedIds(new Set(localIds));
        setStats((prev) => ({ ...prev, saved: localJobs.length }));
      });
  };

  const toggleSave = async (id) => {
    try {
      try {
        const { data } = await api.post(`/jobs/${id}/save`);
        toast.success(data.saved ? "Job saved" : "Removed from saved");
      } catch {
        const { saved } = toggleMockSave(id);
        toast.success(saved ? "Job saved" : "Removed from saved");
      }
      loadSaved();
    } catch {
      toast.error("Could not update saved jobs.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const dash = api
      .get("/dashboard/student")
      .then((r) => {
        if (!cancelled) setStats(r.data);
      })
      .catch(() => {
        if (cancelled) return;
        const s = mockStudentApplicationStats(student.id);
        setStats({
          applications: s.applications,
          saved: listMockSavedJobs().length,
          shortlisted: s.accepted,
          hired: s.accepted,
          profile_completion: 40,
        });
      });
    const rec = fetchJobs()
      .then((list) => {
        if (!cancelled) setRecommended((list || []).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setRecommended([]);
      });

    Promise.allSettled([dash, loadApplications(), loadSaved(), rec]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    const unsubA = subscribeApplications(loadApplications);
    const unsubS = subscribeSavedJobs(loadSaved);
    return () => {
      cancelled = true;
      unsubA();
      unsubS();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  return (
    <DashboardShell title={`Welcome, ${user?.name?.split(" ")[0] || "there"}`}>
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

      {loading ? (
        <div className="mt-6"><StatSkeletonGrid count={4} /></div>
      ) : (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={FileText} label="Applied" value={stats.applications} />
          <StatCard icon={Bookmark} label="Saved" value={stats.saved} />
          <StatCard icon={Sparkles} label="Shortlisted" value={stats.shortlisted} />
          <StatCard icon={CheckCircle2} label="Hired" value={stats.hired} />
        </div>
      )}

      <div className="mt-6">
        <AiMatches />
      </div>

      {/* Saved Jobs */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold">Saved Jobs</h3>
          <Link to="/student/saved" className="text-xs text-neutral-500 hover:text-black">View all</Link>
        </div>
        <div className="mt-4">
          {loading ? (
            <JobCardSkeletonGrid count={3} />
          ) : savedJobs.length === 0 ? (
            <EmptyState
              title="No saved jobs"
              description="Save roles from Browse Jobs to revisit them here."
              ctaLabel="Browse Jobs"
              ctaTo="/jobs"
              icon={Bookmark}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedJobs.map((j, i) => (
                <JobCard key={j.id} job={j} index={i} onSave={toggleSave} saved={savedIds.has(j.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <div className="border skl-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Recent Applications</h3>
            <Link to="/student/applied" className="text-xs text-neutral-500 hover:text-black">View all</Link>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? (
              <ListRowSkeleton count={3} />
            ) : applications.length === 0 ? (
              <EmptyState
                title="No applications yet"
                description="Browse jobs to start applying."
                ctaLabel="Browse Jobs"
                ctaTo="/jobs"
                icon={FileText}
                compact
              />
            ) : (
              applications.map((a) => {
                const jobPath = a.job?.id ? `/jobs/${a.job.id}` : a.job_id ? `/jobs/${a.job_id}` : null;
                const RowTag = jobPath ? Link : "div";
                const rowProps = jobPath ? { to: jobPath } : {};
                return (
                  <RowTag
                    key={a.id}
                    {...rowProps}
                    className="flex items-center justify-between p-3 rounded-xl border skl-border hover:bg-neutral-50 transition"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.job?.title || "Removed job"}</div>
                      <div className="text-xs text-neutral-500 truncate">
                        {a.job?.company_name || "—"}
                        {a.created_at ? ` · ${new Date(a.created_at).toLocaleDateString()}` : ""}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                      {displayApplicationStatus(a.status)}
                    </span>
                  </RowTag>
                );
              })
            )}
          </div>
        </div>

        <div className="border skl-border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Complete your profile</h3>
            <Link to="/student/profile/edit" className="text-xs text-neutral-500 hover:text-black">
              Edit
            </Link>
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

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold">Recommended Jobs</h3>
          <Link to="/jobs" className="text-xs text-neutral-500 hover:text-black">See more</Link>
        </div>
        <div className="mt-5">
          {loading ? (
            <JobCardSkeletonGrid count={3} />
          ) : recommended.length === 0 ? (
            <EmptyState
              title="No recommendations yet"
              description="Open jobs will appear here when available."
              ctaLabel="Browse Jobs"
              ctaTo="/jobs"
              icon={FileText}
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommended.map((j, i) => (
                <JobCard
                  key={j.id}
                  job={j}
                  index={i}
                  onSave={toggleSave}
                  saved={savedIds.has(j.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

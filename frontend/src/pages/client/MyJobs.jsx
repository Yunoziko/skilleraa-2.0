import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import JobStatusBadge from "@/components/JobStatusBadge";
import { ListRowSkeleton } from "@/components/Skeleton";
import ConfirmModal from "@/components/ConfirmModal";
import { Briefcase, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { JOB_STATUSES, displayJobStatus, normalizeJobStatus } from "@/lib/jobStatus";
import { getReviewForJobByClient } from "@/lib/mockReviews";
import { DEMO_CLIENT_PROFILE_ID } from "@/lib/mockProfiles";
import { deleteJob, fetchMyJobs, updateJob } from "@/lib/jobsService";
import { useAuth } from "@/context/AuthContext";

export default function MyJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    fetchMyJobs(user?.id)
      .then((list) => setJobs(list))
      .catch((err) => {
        setJobs([]);
        toast.error(err?.message || "Could not load your jobs");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const changeStatus = async (id, status) => {
    try {
      await updateJob(id, { status });
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status } : j)));
      toast.success(`Marked as ${displayJobStatus(status)}`);
    } catch {
      toast.error("Could not update job status. Try again.");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteJob(pendingDelete);
      toast.success("Job deleted");
      setPendingDelete(null);
      load();
    } catch {
      toast.error("Failed to delete job");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardShell
      title="My Jobs"
      actions={
        <Link
          to="/client/post"
          className="bg-black text-white text-sm px-5 py-2.5 rounded-full hover:bg-black/90"
          data-testid="myjobs-post-new"
        >
          Post New Job
        </Link>
      }
    >
      {loading ? (
        <ListRowSkeleton count={4} />
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No jobs posted yet"
          description="Post your first job to start receiving applications from talented students."
          ctaLabel="Post a Job"
          ctaTo="/client/post"
          icon={Briefcase}
        />
      ) : (
        <div className="border skl-border rounded-2xl divide-y divide-neutral-200 overflow-hidden">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 hover:bg-neutral-50 transition"
              data-testid={`myjob-row-${j.id}`}
            >
              <Link to={`/jobs/${j.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-xl bg-black text-white grid place-items-center font-display font-semibold">
                  {j.company_letter}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2 flex-wrap">
                    <span>{j.title}</span>
                    <JobStatusBadge status={j.status} />
                  </div>
                  <div className="text-xs text-neutral-500 truncate">
                    {j.category} · {j.budget} · {j.duration}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2 ml-0 md:ml-3 shrink-0 flex-wrap justify-end">
                <select
                  value={j.status || "open"}
                  onChange={(e) => changeStatus(j.id, e.target.value)}
                  className="text-[11px] uppercase tracking-widest font-semibold border skl-border rounded-full px-3 py-1.5 bg-white focus:outline-none focus:border-black"
                  data-testid={`myjob-status-${j.id}`}
                >
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {displayJobStatus(s)}
                    </option>
                  ))}
                </select>
                <Link
                  to="/client/applicants"
                  className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full hover:bg-white"
                >
                  {j.applications_count || 0} applicants
                </Link>
                {normalizeJobStatus(j.status) === "completed" && (
                  <Link
                    to={
                      getReviewForJobByClient(j.id, DEMO_CLIENT_PROFILE_ID)
                        ? `/client/reviews?edit=${getReviewForJobByClient(j.id, DEMO_CLIENT_PROFILE_ID).id}`
                        : `/client/reviews?job=${j.id}`
                    }
                    className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full hover:bg-white"
                    data-testid={`myjob-review-${j.id}`}
                  >
                    <Star size={10} />
                    {getReviewForJobByClient(j.id, DEMO_CLIENT_PROFILE_ID) ? "Edit review" : "Leave review"}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setPendingDelete(j.id)}
                  className="p-2 rounded-full border skl-border hover:bg-white text-neutral-600"
                  aria-label="Delete job"
                  data-testid={`myjob-delete-${j.id}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete this job?"
        description="This cannot be undone. Related applications may also be removed."
        confirmLabel="Delete"
        cancelLabel="Keep"
        loading={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </DashboardShell>
  );
}

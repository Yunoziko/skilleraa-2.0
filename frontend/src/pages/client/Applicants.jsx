import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import { Users } from "lucide-react";
import { toast } from "sonner";
import {
  displayApplicationStatus,
  fetchClientApplications,
  updateApplicationStatus,
} from "@/lib/applicationsService";
import { fetchMyJobs } from "@/lib/jobsService";

export default function Applicants() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [jobList, applications] = await Promise.all([
        fetchMyJobs(),
        fetchClientApplications(),
      ]);
      setJobs(jobList);
      setApps(applications);
    } catch (e) {
      toast.error(e?.message || "Failed to load applicants");
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!selectedJob) return apps;
    return apps.filter((a) => a.job_id === selectedJob);
  }, [apps, selectedJob]);

  const accept = async (id) => {
    setBusyId(id);
    try {
      await updateApplicationStatus(id, "accepted");
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: "accepted" } : a)));
      toast.success("Application accepted");
    } catch (e) {
      toast.error(e?.message || "Failed to accept");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id) => {
    setBusyId(id);
    try {
      await updateApplicationStatus(id, "rejected");
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: "rejected" } : a)));
      toast.success("Application rejected");
    } catch (e) {
      toast.error(e?.message || "Failed to reject");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardShell title="Applicants">
      {jobs.length > 0 && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border skl-border p-4">
          <div>
            <div className="text-sm font-medium">Filter by job</div>
            <p className="text-xs text-neutral-500 mt-0.5">View applicants for each of your postings.</p>
          </div>
          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            aria-label="Filter applicants by job"
            className="border skl-border rounded-full px-4 py-2 text-sm bg-white focus:outline-none focus:border-black min-w-[220px]"
            data-testid="applicants-job-select"
          >
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>{j.title}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border skl-border bg-neutral-50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No applicants yet"
          description="Once students apply to your jobs, you'll see them here."
          ctaLabel="Browse Jobs"
          ctaTo="/jobs"
          icon={Users}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const label = displayApplicationStatus(a.status);
            return (
              <div key={a.id} className="border skl-border rounded-2xl p-5" data-testid={`applicant-${a.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-full bg-black text-white grid place-items-center font-display font-semibold">
                      {a.student?.avatar_letter || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{a.student?.name || "Applicant"}</div>
                      <div className="text-xs text-neutral-500">{a.student?.headline || "—"}</div>
                      <div className="mt-2 text-sm text-neutral-700">
                        Applied to{" "}
                        <Link to={`/jobs/${a.job_id}`} className="underline underline-offset-4">
                          {a.job?.title || "Job"}
                        </Link>
                        {a.created_at && (
                          <span className="text-neutral-500"> · {new Date(a.created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      {a.proposal && (
                        <p className="mt-3 text-sm text-neutral-700 bg-neutral-50 border skl-border rounded-xl p-3 whitespace-pre-line">
                          {a.proposal}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">
                        {a.expected_budget && (
                          <span className="border skl-border rounded-full px-2.5 py-1">Bid: {a.expected_budget}</span>
                        )}
                        {a.delivery_time && (
                          <span className="border skl-border rounded-full px-2.5 py-1">Delivery: {a.delivery_time}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                      {label}
                    </span>
                    {label === "Pending" && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => accept(a.id)}
                          className="text-[11px] px-3 py-1.5 rounded-full bg-black text-white hover:bg-black/90 disabled:opacity-60"
                          data-testid={`applicant-${a.id}-accept`}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => reject(a.id)}
                          className="text-[11px] px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50 disabled:opacity-60"
                          data-testid={`applicant-${a.id}-reject`}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

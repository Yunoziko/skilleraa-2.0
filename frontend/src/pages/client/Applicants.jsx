import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { ListRowSkeleton } from "@/components/Skeleton";
import { FileText, Users } from "lucide-react";
import { toast } from "sonner";
import {
  displayApplicationStatus,
  fetchClientApplications,
  isChatEnabled,
  markApplicationCompleted,
  subscribeApplications,
  updateApplicationStatus,
} from "@/lib/applicationsService";
import { fetchMyJobs } from "@/lib/jobsService";
import {
  fetchPaymentsForApplications,
  formatINR,
  payForApplication,
} from "@/lib/paymentsService";
import { formatApiError } from "@/lib/api";
import { getSignedFileUrl } from "@/lib/storageService";

export default function Applicants() {
  const [apps, setApps] = useState([]);
  const [payments, setPayments] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadPayments = async (applications) => {
    try {
      const map = await fetchPaymentsForApplications((applications || []).map((a) => a.id));
      setPayments(map);
    } catch {
      setPayments({});
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [jobList, applications] = await Promise.all([
        fetchMyJobs(),
        fetchClientApplications(),
      ]);
      setJobs(jobList);
      setApps(applications);
      await loadPayments(applications);
    } catch (e) {
      setError(e?.message || "Failed to load applicants");
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const safeLoad = () => {
      if (active) load();
    };
    safeLoad();
    const unsub = subscribeApplications((payload) => {
      if (!active) return;
      const row = payload?.new;
      if (!row?.id) {
        safeLoad();
        return;
      }
      setApps((prev) => {
        const idx = prev.findIndex((a) => a.id === row.id);
        if (idx === -1) {
          safeLoad();
          return prev;
        }
        const next = prev.slice();
        next[idx] = { ...next[idx], status: row.status };
        return next;
      });
    });
    return () => {
      active = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openResume = async (path) => {
    if (!path) return;
    try {
      const url = await getSignedFileUrl(path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("Could not open resume");
    } catch (e) {
      toast.error(e?.message || "Could not open resume");
    }
  };

  const filtered = useMemo(() => {
    if (!selectedJob) return apps;
    return apps.filter((a) => a.job_id === selectedJob);
  }, [apps, selectedJob]);

  const accept = async (id) => {
    setBusyId(id);
    try {
      const updated = await updateApplicationStatus(id, "accepted");
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated, status: "accepted" } : a)));
      toast.success("Application accepted — you can pay and chat now");
    } catch (e) {
      toast.error(e?.message || "Failed to accept");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id) => {
    setBusyId(id);
    try {
      const updated = await updateApplicationStatus(id, "rejected");
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated, status: "rejected" } : a)));
      toast.success("Application rejected");
    } catch (e) {
      toast.error(e?.message || "Failed to reject");
    } finally {
      setBusyId(null);
    }
  };

  const complete = async (id) => {
    setBusyId(id);
    try {
      const updated = await markApplicationCompleted(id);
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated, status: "completed" } : a)));
      toast.success("Marked completed — reviews unlocked");
    } catch (e) {
      toast.error(e?.message || "Failed to mark complete");
    } finally {
      setBusyId(null);
    }
  };

  const payNow = async (application) => {
    setBusyId(application.id);
    try {
      await payForApplication(application.id);
      toast.success("Payment successful");
      await loadPayments(apps);
    } catch (e) {
      if (e?.message === "Payment cancelled") return;
      const msg = formatApiError(e?.response?.data?.detail || e?.message);
      toast.error(msg);
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
        <ListRowSkeleton count={4} />
      ) : error ? (
        <ErrorState title="Couldn’t load applicants" description={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No applicants yet"
          description="Once students apply to your jobs, you'll see them here."
          ctaLabel="Post a Job"
          ctaTo="/client/post"
          icon={Users}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const label = displayApplicationStatus(a.status);
            const chatOn = isChatEnabled(a.status);
            const payment = payments[a.id];
            const paid = payment?.status === "paid";
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
                      {a.student?.resume_url && (
                        <button
                          type="button"
                          onClick={() => openResume(a.student.resume_url)}
                          className="mt-3 inline-flex items-center gap-1.5 text-xs underline underline-offset-4 text-neutral-600 hover:text-black"
                          data-testid={`applicant-${a.id}-resume`}
                        >
                          <FileText size={12} /> View resume
                        </button>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">
                        {a.expected_budget && (
                          <span className="border skl-border rounded-full px-2.5 py-1">Bid: {a.expected_budget}</span>
                        )}
                        {a.delivery_time && (
                          <span className="border skl-border rounded-full px-2.5 py-1">Delivery: {a.delivery_time}</span>
                        )}
                        {paid && (
                          <span className="border skl-border rounded-full px-2.5 py-1" data-testid={`applicant-${a.id}-paid`}>
                            Paid {formatINR(payment.amount)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                      {label}
                    </span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {chatOn && !paid && (
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => payNow(a)}
                          className="text-[11px] px-3 py-1.5 rounded-full bg-black text-white hover:bg-black/90 disabled:opacity-60"
                          data-testid={`applicant-${a.id}-pay`}
                        >
                          Pay Now
                        </button>
                      )}
                      {label === "Accepted" && (
                        <button
                          type="button"
                          disabled={busyId === a.id}
                          onClick={() => complete(a.id)}
                          className="text-[11px] px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50 disabled:opacity-60"
                          data-testid={`applicant-${a.id}-complete`}
                        >
                          Mark complete
                        </button>
                      )}
                      {label === "Completed" && (
                        <Link
                          to="/client/reviews"
                          className="text-[11px] px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                          data-testid={`applicant-${a.id}-review`}
                        >
                          Leave review
                        </Link>
                      )}
                      {chatOn ? (
                        <Link
                          to={`/client/messages?c=${a.id}`}
                          className="text-[11px] px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                          data-testid={`applicant-${a.id}-message`}
                        >
                          Message
                        </Link>
                      ) : label === "Pending" ? (
                        <span className="text-[10px] text-neutral-400 px-1 py-1.5">
                          Chat after accept
                        </span>
                      ) : null}
                      {label === "Pending" && (
                        <>
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
                        </>
                      )}
                    </div>
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

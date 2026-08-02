import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { ListRowSkeleton } from "@/components/Skeleton";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import {
  displayApplicationStatus,
  fetchMyApplications,
  isChatEnabled,
  subscribeApplications,
} from "@/lib/applicationsService";

export default function AppliedJobs() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    return fetchMyApplications()
      .then((list) => setApps(list))
      .catch((e) => {
        setError(e?.message || "Failed to load applications");
        setApps([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchMyApplications()
      .then((list) => {
        if (active) setApps(list);
      })
      .catch((e) => {
        if (!active) return;
        setError(e?.message || "Failed to load applications");
        setApps([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsub = subscribeApplications((payload) => {
      if (!active) return;
      const row = payload?.new;
      if (!row?.id) {
        load();
        return;
      }
      setApps((prev) => {
        const idx = prev.findIndex((a) => a.id === row.id);
        if (idx === -1) {
          load();
          return prev;
        }
        const next = prev.slice();
        const prevStatus = next[idx].status;
        next[idx] = { ...next[idx], status: row.status };
        if (isChatEnabled(row.status) && !isChatEnabled(prevStatus)) {
          toast.success("Application accepted — you can message the client now");
        }
        return next;
      });
    });

    return () => {
      active = false;
      unsub();
    };
  }, []);

  return (
    <DashboardShell title="My Applications">
      {loading ? (
        <ListRowSkeleton count={3} />
      ) : error ? (
        <ErrorState title="Couldn’t load applications" description={error} onRetry={load} />
      ) : apps.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Browse open jobs and apply — recruiters can respond within hours."
          ctaLabel="Browse Jobs"
          ctaTo="/jobs"
          icon={FileText}
        />
      ) : (
        <div className="border skl-border rounded-2xl divide-y divide-neutral-200 overflow-hidden">
          {apps.map((a) => {
            const jobPath = a.job?.id ? `/jobs/${a.job.id}` : a.job_id ? `/jobs/${a.job_id}` : null;
            const chatOn = isChatEnabled(a.status);
            return (
              <div
                key={a.id}
                className="flex items-center justify-between p-5 hover:bg-neutral-50 transition"
                data-testid={`applied-row-${a.id}`}
              >
                {jobPath ? (
                  <Link to={jobPath} className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-black text-white grid place-items-center font-display font-semibold">
                      {a.job?.company_letter || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.job?.title || "Removed job"}</div>
                      <div className="text-xs text-neutral-500 truncate">
                        {a.job?.company_name || "—"} · Applied {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                        {a.expected_budget ? ` · Bid ${a.expected_budget}` : ""}
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-black text-white grid place-items-center font-display font-semibold">?</div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">Removed job</div>
                    </div>
                  </div>
                )}
                <div className="ml-3 shrink-0 flex items-center gap-2">
                  {chatOn ? (
                    <Link
                      to={`/student/messages?c=${a.id}`}
                      className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full hover:bg-neutral-50"
                      data-testid={`applied-message-${a.id}`}
                    >
                      Message
                    </Link>
                  ) : (
                    <span
                      className="text-[10px] uppercase tracking-widest font-semibold text-neutral-400 px-2 py-1"
                      data-testid={`applied-chat-locked-${a.id}`}
                    >
                      Chat locked
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                    {displayApplicationStatus(a.status)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

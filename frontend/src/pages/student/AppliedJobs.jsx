import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import {
  displayApplicationStatus,
  fetchMyApplications,
} from "@/lib/applicationsService";

export default function AppliedJobs() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMyApplications()
      .then((list) => {
        if (active) setApps(list);
      })
      .catch((e) => {
        if (!active) return;
        toast.error(e?.message || "Failed to load applications");
        setApps([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <DashboardShell title="My Applications">
      {loading ? (
        <ListRowSkeleton count={3} />
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
            const RowTag = jobPath ? Link : "div";
            const rowProps = jobPath ? { to: jobPath } : {};
            return (
              <RowTag
                key={a.id}
                {...rowProps}
                className="flex items-center justify-between p-5 hover:bg-neutral-50 transition"
                data-testid={`applied-row-${a.id}`}
              >
                <div className="flex items-center gap-4 min-w-0">
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
                </div>
                <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full ml-3 shrink-0">
                  {displayApplicationStatus(a.status)}
                </span>
              </RowTag>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

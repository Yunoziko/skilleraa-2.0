import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import api from "@/lib/api";
import { FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  displayApplicationStatus,
  listMyMockApplications,
  resolveApplicantStudent,
  subscribeApplications,
} from "@/lib/mockApplications";

export default function AppliedJobs() {
  const { user } = useAuth();
  const student = resolveApplicantStudent(user);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api
      .get("/applications/mine")
      .then((r) => {
        const remote = Array.isArray(r.data) ? r.data : [];
        const local = listMyMockApplications(student.id);
        const remoteIds = new Set(remote.map((a) => a.id));
        const merged = [...remote, ...local.filter((a) => !remoteIds.has(a.id))];
        setApps(merged);
      })
      .catch(() => {
        setApps(listMyMockApplications(student.id));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    return subscribeApplications(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

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

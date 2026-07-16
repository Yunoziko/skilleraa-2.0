import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import api from "@/lib/api";
import { FileText } from "lucide-react";

export default function AppliedJobs() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/applications/mine").then((r) => setApps(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell title="Applied Jobs">
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border skl-border bg-neutral-50 animate-pulse" />
          ))}
        </div>
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
          {apps.map((a) => (
            <Link
              key={a.id}
              to={a.job ? `/jobs/${a.job.id}` : "#"}
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
                    {a.job?.company_name} · {new Date(a.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full ml-3 shrink-0">
                {a.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

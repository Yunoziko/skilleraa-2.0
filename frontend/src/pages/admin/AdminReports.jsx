import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/layout/AdminShell";
import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import {
  dismissReport,
  formatAdminDate,
  listAdminReports,
  resolveReport,
  subscribeAdmin,
} from "@/lib/mockAdmin";

const TYPE_TABS = [
  { key: "all", label: "All reports" },
  { key: "user", label: "Reported users" },
  { key: "job", label: "Reported jobs" },
];

const STATUS_TABS = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
  { key: "all", label: "All" },
];

export default function AdminReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("open");

  const load = () => {
    setReports(listAdminReports({ type, status }));
    setLoading(false);
  };

  useEffect(() => {
    load();
    return subscribeAdmin(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status]);

  const onResolve = (id) => {
    try {
      resolveReport(id);
      toast.success("Report resolved");
      load();
    } catch (e) {
      toast.error(e.message || "Could not resolve");
    }
  };

  const onDismiss = (id) => {
    try {
      dismissReport(id);
      toast.success("Report dismissed");
      load();
    } catch (e) {
      toast.error(e.message || "Could not dismiss");
    }
  };

  return (
    <AdminShell title="Reports">
      <div className="flex flex-wrap gap-2 mb-3">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={`text-xs px-4 py-2 rounded-full border transition ${
              type === t.key ? "bg-black text-white border-black" : "skl-border hover:bg-neutral-50"
            }`}
            data-testid={`reports-type-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
              status === t.key ? "bg-black text-white border-black" : "skl-border hover:bg-neutral-50"
            }`}
            data-testid={`reports-status-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <ListRowSkeleton count={4} />
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports"
          description="Nothing in this filter right now."
          icon={Flag}
        />
      ) : (
        <div className="space-y-3" data-testid="admin-reports-list">
          {reports.map((r) => (
            <div key={r.id} className="border skl-border rounded-2xl p-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-0.5 rounded-full">
                      {r.type}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${
                        r.status === "open"
                          ? "bg-black text-white border-black"
                          : "skl-border text-neutral-500"
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="font-medium">{r.target_label}</span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-700">{r.reason}</p>
                  <div className="mt-2 text-xs text-neutral-500">
                    Reported by {r.reporter} · {formatAdminDate(r.created_at)}
                    {r.resolved_at ? ` · Closed ${formatAdminDate(r.resolved_at)}` : ""}
                  </div>
                </div>
                {r.status === "open" && (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onResolve(r.id)}
                      className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-black/90"
                      data-testid={`resolve-report-${r.id}`}
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismiss(r.id)}
                      className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                      data-testid={`dismiss-report-${r.id}`}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

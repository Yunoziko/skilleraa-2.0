import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { ListRowSkeleton } from "@/components/Skeleton";
import { displayApplicationStatus } from "@/lib/applicationsService";
import { fetchAdminApplications, formatAdminDate, formatRevenue } from "@/lib/adminService";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
  { key: "completed", label: "Completed" },
];

export default function AdminApplications() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setApps(await fetchAdminApplications({ status }));
    } catch (e) {
      setError(e?.message || "Failed to load applications");
      setApps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await fetchAdminApplications({ status });
        if (active) setApps(list);
      } catch (e) {
        if (!active) return;
        setError(e?.message || "Failed to load applications");
        setApps([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [status]);

  return (
    <AdminShell title="Applications">
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatus(t.key)}
            className={`text-xs px-4 py-2 rounded-full border transition ${
              status === t.key ? "bg-black text-white border-black" : "skl-border hover:bg-neutral-50"
            }`}
            data-testid={`apps-status-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <ListRowSkeleton count={5} />
      ) : error ? (
        <ErrorState title="Couldn’t load applications" description={error} onRetry={load} />
      ) : apps.length === 0 ? (
        <EmptyState title="No applications" description="Nothing matches this filter." icon={FileText} />
      ) : (
        <div className="space-y-3" data-testid="admin-applications-list">
          {apps.map((a) => (
            <div key={a.id} className="border skl-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{a.freelancer_name}</span>
                    <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-0.5 rounded-full">
                      {displayApplicationStatus(a.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-neutral-600">
                    Applied to{" "}
                    {a.job_id ? (
                      <Link to={`/jobs/${a.job_id}`} className="underline underline-offset-4">
                        {a.job_title}
                      </Link>
                    ) : (
                      a.job_title
                    )}
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Bid {formatRevenue(a.bid_amount)} · {a.estimated_days} days · {formatAdminDate(a.created_at)}
                  </div>
                </div>
                {a.freelancer_id && (
                  <Link
                    to={`/u/${a.freelancer_id}`}
                    className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                  >
                    View profile
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

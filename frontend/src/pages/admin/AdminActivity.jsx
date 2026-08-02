import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { ListRowSkeleton } from "@/components/Skeleton";
import {
  fetchAdminAuditLogs,
  formatAdminDate,
  labelAuditAction,
} from "@/lib/adminService";

export default function AdminActivity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setLogs(await fetchAdminAuditLogs({ limit: 100 }));
    } catch (e) {
      setError(e?.message || "Failed to load audit log");
      setLogs([]);
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
        const list = await fetchAdminAuditLogs({ limit: 100 });
        if (active) setLogs(list);
      } catch (e) {
        if (!active) return;
        setError(e?.message || "Failed to load audit log");
        setLogs([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell title="Audit log">
      <p className="text-sm text-neutral-600 mb-6">
        Basic moderation history — suspend/reactivate users, deleted jobs, and removed reviews.
      </p>
      {loading ? (
        <ListRowSkeleton count={6} />
      ) : error ? (
        <ErrorState title="Couldn’t load audit log" description={error} onRetry={load} />
      ) : logs.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Actions you take in admin tools will appear here."
          icon={ScrollText}
        />
      ) : (
        <div className="border skl-border rounded-2xl divide-y divide-neutral-200 overflow-hidden" data-testid="admin-audit-log">
          {logs.map((a) => (
            <div key={a.id} className="p-4 md:p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{labelAuditAction(a.action)}</div>
                <div className="mt-0.5 text-xs text-neutral-500">
                  {a.entity_type}
                  {a.entity_id ? ` · ${a.entity_id}` : ""}
                  {a.details ? ` · ${a.details}` : ""}
                </div>
              </div>
              <div className="text-xs text-neutral-400 shrink-0">{formatAdminDate(a.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

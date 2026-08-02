import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import { Briefcase, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  acceptDelivery,
  displayProjectStatus,
  formatProjectDate,
  groupClientOrders,
  listClientOrders,
  markComplete,
  requestRevision,
  subscribeProjects,
} from "@/lib/mockProjects";
import { useAuth } from "@/context/AuthContext";

const TABS = [
  { key: "active", label: "Active Orders" },
  { key: "pendingApproval", label: "Pending Approval" },
  { key: "completed", label: "Completed Orders" },
];

export default function ClientOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");

  const load = () => {
    setOrders(listClientOrders(user?.id || ""));
    setLoading(false);
  };

  useEffect(() => {
    load();
    return subscribeProjects(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const groups = useMemo(() => groupClientOrders(orders), [orders]);
  const visible = groups[tab] || [];

  const onAccept = (id) => {
    try {
      acceptDelivery(id);
      toast.success("Delivery accepted");
      load();
    } catch (e) {
      toast.error(e.message || "Could not accept");
    }
  };

  const onRevision = (id) => {
    try {
      requestRevision(id);
      toast.success("Revision requested");
      load();
    } catch (e) {
      toast.error(e.message || "Could not request revision");
    }
  };

  const onComplete = async (id) => {
    try {
      const updated = markComplete(id);
      // Real hire flow: unlock reviews when order is tied to a Supabase application
      if (updated?.application_id) {
        try {
          const { markApplicationCompleted } = await import("@/lib/applicationsService");
          await markApplicationCompleted(updated.application_id);
        } catch {
          /* mock-only orders have no application row */
        }
      }
      toast.success(
        updated?.application_id
          ? "Order marked complete — reviews unlocked"
          : "Order marked complete (demo). For paid hires, use Applicants → Mark complete."
      );
      load();
    } catch (e) {
      toast.error(e.message || "Could not complete");
    }
  };

  return (
    <DashboardShell title="Orders">
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`text-xs px-4 py-2 rounded-full border transition ${
              tab === t.key ? "bg-black text-white border-black" : "skl-border hover:bg-neutral-50"
            }`}
            data-testid={`orders-tab-${t.key}`}
          >
            {t.label} ({groups[t.key]?.length || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <ListRowSkeleton count={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={`No ${TABS.find((t) => t.key === tab)?.label.toLowerCase() || "orders"}`}
          description="Orders appear here when you hire a student on a job."
          icon={Briefcase}
          ctaLabel="My Jobs"
          ctaTo="/client/jobs"
        />
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <div
              key={p.id}
              className="border skl-border rounded-2xl p-5"
              data-testid={`client-order-${p.id}`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/projects/${p.id}`}
                      className="font-medium hover:underline underline-offset-4"
                    >
                      {p.title}
                    </Link>
                    <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                      {displayProjectStatus(p.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {p.student_name} · Due {formatProjectDate(p.due_date)} · {p.budget}
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
                      <span>Progress</span>
                      <span className="font-medium text-neutral-700">{p.progress || 0}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full bg-black transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, p.progress || 0))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    to={`/projects/${p.id}`}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                  >
                    View <ArrowUpRight size={12} />
                  </Link>
                  {p.status === "delivered" && (
                    <>
                      <button
                        type="button"
                        onClick={() => onAccept(p.id)}
                        className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-black/90"
                        data-testid={`accept-${p.id}`}
                      >
                        Accept Delivery
                      </button>
                      <button
                        type="button"
                        onClick={() => onRevision(p.id)}
                        className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                        data-testid={`revision-${p.id}`}
                      >
                        Request Revision
                      </button>
                    </>
                  )}
                  {(p.status === "active" || p.status === "revision" || p.status === "pending") && (
                    <button
                      type="button"
                      onClick={() => onComplete(p.id)}
                      className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                      data-testid={`complete-${p.id}`}
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

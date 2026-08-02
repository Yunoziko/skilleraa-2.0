import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  GraduationCap,
  Building2,
  Briefcase,
  FileText,
  CreditCard,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import ErrorState from "@/components/ErrorState";
import { StatSkeletonGrid } from "@/components/Skeleton";
import {
  fetchAdminAuditLogs,
  fetchAdminOverview,
  formatAdminDate,
  formatRevenue,
  labelAuditAction,
} from "@/lib/adminService";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const [overview, logs] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminAuditLogs({ limit: 8 }),
      ]);
      setStats(overview);
      setActivity(logs);
    } catch (e) {
      setError(e?.message || "Failed to load overview");
      setStats(null);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [overview, logs] = await Promise.all([
          fetchAdminOverview(),
          fetchAdminAuditLogs({ limit: 8 }),
        ]);
        if (!active) return;
        setStats(overview);
        setActivity(logs);
      } catch (e) {
        if (!active) return;
        setError(e?.message || "Failed to load overview");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const cards = stats
    ? [
        { label: "Total Users", value: stats.total_users, icon: Users },
        { label: "Total Students", value: stats.total_students, icon: GraduationCap },
        { label: "Total Clients", value: stats.total_clients, icon: Building2 },
        { label: "Total Jobs", value: stats.total_jobs, icon: Briefcase },
        { label: "Total Applications", value: stats.total_applications, icon: FileText },
        { label: "Total Payments", value: stats.total_payments, icon: CreditCard },
        { label: "Total Revenue", value: formatRevenue(stats.total_revenue), icon: Wallet },
      ]
    : [];

  return (
    <AdminShell title="Admin Overview">
      {error ? (
        <ErrorState title="Couldn’t load overview" description={error} onRetry={load} />
      ) : !stats ? (
        <StatSkeletonGrid count={7} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="admin-overview-stats">
            {cards.map((c) => (
              <div key={c.label} className="border skl-border rounded-2xl p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500 font-semibold">
                    {c.label}
                  </div>
                  <c.icon size={14} className="text-neutral-400 shrink-0" />
                </div>
                <div className="mt-3 font-display text-2xl md:text-3xl tracking-tight font-medium">
                  {c.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 grid sm:grid-cols-2 gap-3">
            <QuickLink to="/admin/users" title="Manage users" meta={`${stats.suspended_users} suspended`} />
            <QuickLink to="/admin/jobs" title="Moderate jobs" meta={`${stats.total_jobs} listings`} />
            <QuickLink to="/admin/applications" title="Applications" meta={`${stats.total_applications} total`} />
            <QuickLink to="/admin/reviews" title="Reviews" meta={`${stats.total_reviews} reviews`} />
            <QuickLink to="/admin/analytics" title="Analytics" meta="Weekly trends" />
            <QuickLink to="/admin/activity" title="Audit log" meta="Recent moderation actions" />
          </div>

          <section className="mt-8 border skl-border rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
                Recent activity
              </h2>
              <Link to="/admin/activity" className="text-xs underline underline-offset-4 text-neutral-600">
                View all
              </Link>
            </div>
            {activity.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">No moderation actions yet.</p>
            ) : (
              <ul className="mt-4 space-y-3" data-testid="admin-recent-activity">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm border-b skl-border pb-3 last:border-0">
                    <div>
                      <div className="font-medium">{labelAuditAction(a.action)}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {a.details || `${a.entity_type} ${a.entity_id || ""}`}
                      </div>
                    </div>
                    <div className="text-xs text-neutral-400 shrink-0">{formatAdminDate(a.created_at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}

function QuickLink({ to, title, meta }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 border skl-border rounded-2xl p-5 hover:bg-neutral-50 transition"
    >
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-neutral-500 mt-0.5">{meta}</div>
      </div>
      <ArrowUpRight size={16} className="text-neutral-400 shrink-0" />
    </Link>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Building2,
  Briefcase,
  FolderKanban,
  CheckCircle2,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import AdminShell from "@/components/layout/AdminShell";
import { StatSkeletonGrid } from "@/components/Skeleton";
import {
  formatRevenue,
  getAdminOverview,
  subscribeAdmin,
} from "@/lib/mockAdmin";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = () => setStats(getAdminOverview());
    load();
    return subscribeAdmin(load);
  }, []);

  const cards = stats
    ? [
        { label: "Total Students", value: stats.total_students, icon: Users },
        { label: "Total Clients", value: stats.total_clients, icon: Building2 },
        { label: "Total Jobs", value: stats.total_jobs, icon: Briefcase },
        { label: "Active Projects", value: stats.active_projects, icon: FolderKanban },
        { label: "Completed Projects", value: stats.completed_projects, icon: CheckCircle2 },
        { label: "Revenue (mock)", value: formatRevenue(stats.revenue), icon: Wallet },
      ]
    : [];

  return (
    <AdminShell title="Admin Overview">
      {!stats ? (
        <StatSkeletonGrid count={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3" data-testid="admin-overview-stats">
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
            <QuickLink
              to="/admin/reports"
              title="Open reports"
              meta={`${stats.open_reports} awaiting review`}
            />
            <QuickLink
              to="/admin/users"
              title="Suspended users"
              meta={`${stats.suspended_users} currently suspended`}
            />
            <QuickLink to="/admin/jobs" title="Manage jobs" meta="Close or remove listings" />
            <QuickLink to="/admin/analytics" title="Analytics" meta="Signups, categories, completions" />
          </div>

          <p className="mt-8 text-xs text-neutral-500">
            Offline mock admin — data in localStorage. Auth & Supabase remain paused.
          </p>
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

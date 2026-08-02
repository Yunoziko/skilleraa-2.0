import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/layout/AdminShell";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { ListRowSkeleton } from "@/components/Skeleton";
import {
  adminSetUserStatus,
  fetchAdminUserCounts,
  fetchAdminUsers,
  formatAdminDate,
} from "@/lib/adminService";

const ROLE_TABS = [
  { key: "all", label: "All" },
  { key: "student", label: "Students" },
  { key: "client", label: "Clients" },
];

const STATUS_OPTS = [
  { key: "all", label: "All statuses" },
  { key: "active", label: "Active" },
  { key: "suspended", label: "Suspended" },
];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [counts, setCounts] = useState({ all: 0, student: 0, client: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [filtered, nextCounts] = await Promise.all([
        fetchAdminUsers({ role, status, q }),
        fetchAdminUserCounts(),
      ]);
      setUsers(filtered);
      setCounts(nextCounts);
    } catch (e) {
      setError(e?.message || "Failed to load users");
      setUsers([]);
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
        const [filtered, nextCounts] = await Promise.all([
          fetchAdminUsers({ role, status, q }),
          fetchAdminUserCounts(),
        ]);
        if (!active) return;
        setUsers(filtered);
        setCounts(nextCounts);
      } catch (e) {
        if (!active) return;
        setError(e?.message || "Failed to load users");
        setUsers([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [role, status, q]);

  const onSuspend = async (id) => {
    setBusyId(id);
    try {
      await adminSetUserStatus(id, "suspended");
      toast.success("User suspended");
      await load();
    } catch (e) {
      toast.error(e?.message || "Could not suspend");
    } finally {
      setBusyId(null);
    }
  };

  const onRestore = async (id) => {
    setBusyId(id);
    try {
      await adminSetUserStatus(id, "active");
      toast.success("User reactivated");
      await load();
    } catch (e) {
      toast.error(e?.message || "Could not reactivate");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell title="Users">
      <div className="flex flex-wrap gap-2 mb-4">
        {ROLE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setRole(t.key)}
            className={`text-xs px-4 py-2 rounded-full border transition ${
              role === t.key ? "bg-black text-white border-black" : "skl-border hover:bg-neutral-50"
            }`}
            data-testid={`users-role-${t.key}`}
          >
            {t.label} ({counts[t.key] ?? 0})
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or user id…"
            className="w-full border skl-border rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black"
            data-testid="admin-users-search"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border skl-border rounded-full px-4 py-2.5 text-sm bg-white outline-none"
          data-testid="admin-users-status-filter"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <ListRowSkeleton count={5} />
      ) : error ? (
        <ErrorState title="Couldn’t load users" description={error} onRetry={load} />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" description="Try another search or filter." icon={Search} />
      ) : (
        <div className="space-y-3" data-testid="admin-users-list">
          {users.map((u) => (
            <div
              key={u.id}
              className="border skl-border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="min-w-0 flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-black text-white grid place-items-center font-display font-semibold shrink-0">
                  {(u.name || "?").charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-0.5 rounded-full">
                      {u.role}
                    </span>
                    <span
                      className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${
                        u.status === "suspended"
                          ? "bg-neutral-100 text-neutral-600 skl-border"
                          : "bg-black text-white border-black"
                      }`}
                    >
                      {u.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500 truncate">
                    Rating {u.review_count ? Number(u.average_rating).toFixed(1) : "—"} · {u.review_count} reviews
                  </div>
                  <div className="mt-1 text-xs text-neutral-400">Joined {formatAdminDate(u.joined_at)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link
                  to={`/u/${u.id}`}
                  className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                  data-testid={`view-user-${u.id}`}
                >
                  View profile
                </Link>
                {u.status === "suspended" ? (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => onRestore(u.id)}
                    className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-black/90 disabled:opacity-60"
                    data-testid={`restore-user-${u.id}`}
                  >
                    Reactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => onSuspend(u.id)}
                    className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50 disabled:opacity-60"
                    data-testid={`suspend-user-${u.id}`}
                  >
                    Suspend
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/layout/AdminShell";
import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import {
  formatAdminDate,
  listAdminUsers,
  restoreUser,
  subscribeAdmin,
  suspendUser,
} from "@/lib/mockAdmin";

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
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");

  const load = () => {
    setUsers(listAdminUsers({ role, status, q }));
    setLoading(false);
  };

  useEffect(() => {
    load();
    return subscribeAdmin(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, status, q]);

  const allUsers = listAdminUsers();
  const counts = {
    all: allUsers.length,
    student: allUsers.filter((u) => u.role === "student").length,
    client: allUsers.filter((u) => u.role === "client").length,
  };

  const onSuspend = (id) => {
    try {
      suspendUser(id);
      toast.success("User suspended");
      load();
    } catch (e) {
      toast.error(e.message || "Could not suspend");
    }
  };

  const onRestore = (id) => {
    try {
      restoreUser(id);
      toast.success("User restored");
      load();
    } catch (e) {
      toast.error(e.message || "Could not restore");
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
            placeholder="Search name, email, company…"
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
                    {u.email}
                    {u.company ? ` · ${u.company}` : ""}
                    {u.location ? ` · ${u.location}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-neutral-400">Joined {formatAdminDate(u.joined_at)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {u.status === "suspended" ? (
                  <button
                    type="button"
                    onClick={() => onRestore(u.id)}
                    className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-black/90"
                    data-testid={`restore-user-${u.id}`}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSuspend(u.id)}
                    className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
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

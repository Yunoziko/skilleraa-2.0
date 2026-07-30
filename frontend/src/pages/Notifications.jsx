import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import { Bell } from "lucide-react";
import {
  formatNotificationTime,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from "@/lib/mockNotifications";

export default function Notifications() {
  const { pathname } = useLocation();
  const audience = pathname.startsWith("/client") ? "client" : "student";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setItems(listNotifications(audience));
    setLoading(false);
  };

  useEffect(() => {
    load();
    return subscribeNotifications(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  return (
    <DashboardShell
      title="Notifications"
      actions={
        items.some((n) => !n.read) ? (
          <button
            type="button"
            onClick={() => {
              markAllNotificationsRead(audience);
              load();
            }}
            className="text-sm px-4 py-2 rounded-full border skl-border hover:bg-neutral-50"
            data-testid="notifications-mark-all"
          >
            Mark all read
          </button>
        ) : null
      }
    >
      {loading ? (
        <ListRowSkeleton count={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          description="Notifications for job matches, application updates, and messages will appear here."
          icon={Bell}
        />
      ) : (
        <div className="border skl-border rounded-2xl divide-y divide-neutral-200 overflow-hidden" data-testid="notifications-list">
          {items.map((n) => (
            <Link
              key={n.id}
              to={n.href || "#"}
              onClick={() => markNotificationRead(n.id)}
              className={`flex items-start justify-between gap-4 p-5 hover:bg-neutral-50 transition ${
                n.read ? "" : "bg-neutral-50/70"
              }`}
              data-testid={`notification-row-${n.id}`}
            >
              <div className="min-w-0 flex items-start gap-3">
                <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-black"}`} />
                <div className="min-w-0">
                  <div className="font-medium text-sm">{n.title}</div>
                  <p className="mt-1 text-sm text-neutral-600">{n.body}</p>
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-400 shrink-0">
                {formatNotificationTime(n.created_at)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

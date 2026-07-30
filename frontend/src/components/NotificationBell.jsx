import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import {
  formatNotificationTime,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
  unreadNotificationCount,
} from "@/lib/mockNotifications";

export default function NotificationBell({
  inboxPath = "/student/notifications",
  audience = "student",
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef(null);

  const refresh = () => {
    setItems(listNotifications(audience).slice(0, 6));
    setUnread(unreadNotificationCount(audience));
  };

  useEffect(() => {
    refresh();
    return subscribeNotifications(refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onItemClick = (n) => {
    markNotificationRead(n.id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={rootRef} data-testid="notification-bell">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full border skl-border hover:bg-neutral-50 transition"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
        data-testid="notification-bell-btn"
      >
        <Bell size={16} aria-hidden />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-black text-white text-[10px] font-semibold grid place-items-center"
            data-testid="notification-unread-badge"
            aria-hidden
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[min(100vw-2rem,22rem)] bg-white border skl-border rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.1)] overflow-hidden z-50"
          role="menu"
          data-testid="notification-dropdown"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b skl-border">
            <div className="text-sm font-medium">Notifications</div>
            <button
              type="button"
              onClick={() => {
                markAllNotificationsRead(audience);
                refresh();
              }}
              className="text-[11px] text-neutral-500 hover:text-black"
              data-testid="notification-mark-all"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="p-6 text-sm text-neutral-500 text-center">You're all caught up.</div>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  to={n.href || inboxPath}
                  onClick={() => onItemClick(n)}
                  role="menuitem"
                  className={`block px-4 py-3 border-b skl-border last:border-0 hover:bg-neutral-50 transition ${
                    n.read ? "" : "bg-neutral-50/80"
                  }`}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-black shrink-0" aria-hidden />}
                        {n.title}
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-600 line-clamp-2">{n.body}</p>
                    </div>
                    <span className="text-[10px] text-neutral-400 shrink-0 whitespace-nowrap">
                      {formatNotificationTime(n.created_at)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link
            to={inboxPath}
            onClick={() => setOpen(false)}
            className="block text-center text-xs font-medium py-3 border-t skl-border hover:bg-neutral-50"
            data-testid="notification-view-all"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}

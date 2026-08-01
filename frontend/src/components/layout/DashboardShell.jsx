import { useEffect, useState } from "react";
import { NavLink, Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Search,
  FileText,
  Bookmark,
  Bell,
  User,
  Settings,
  Briefcase,
  PlusSquare,
  Users,
  Building2,
  LogOut,
  MessageSquare,
  Star,
  FolderKanban,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import { btnGhost } from "@/lib/uiClasses";
import { subscribeMessages, totalUnreadMessages } from "@/lib/messagesService";

const studentNav = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/jobs", label: "Browse Jobs", icon: Search },
  { to: "/student/applied", label: "Applied Jobs", icon: FileText },
  { to: "/student/saved", label: "Saved Jobs", icon: Bookmark },
  { to: "/student/projects", label: "Projects", icon: FolderKanban },
  { to: "/student/wallet", label: "Wallet", icon: Wallet },
  { to: "/student/reviews", label: "Reviews", icon: Star },
  { to: "/student/messages", label: "Messages", icon: MessageSquare },
  { to: "/student/notifications", label: "Notifications", icon: Bell },
  { to: "/student/profile", label: "Profile", icon: User },
  { to: "/student/settings", label: "Settings", icon: Settings },
];

const clientNav = [
  { to: "/client", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/client/post", label: "Post Job", icon: PlusSquare },
  { to: "/client/jobs", label: "My Jobs", icon: Briefcase },
  { to: "/client/orders", label: "Orders", icon: FolderKanban },
  { to: "/client/applicants", label: "Applicants", icon: Users },
  { to: "/client/reviews", label: "Reviews", icon: Star },
  { to: "/client/messages", label: "Messages", icon: MessageSquare },
  { to: "/client/notifications", label: "Notifications", icon: Bell },
  { to: "/client/profile", label: "Company Profile", icon: Building2 },
  { to: "/client/settings", label: "Settings", icon: Settings },
];

export default function DashboardShell({ children, title, actions }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [unreadMessages, setUnreadMessages] = useState(0);
  // Offline demo: infer role from URL when auth is paused
  const isClient =
    user?.role === "client" ||
    ((!user || user === false) && pathname.startsWith("/client"));
  const items = isClient ? clientNav : studentNav;
  const notificationsPath = isClient ? "/client/notifications" : "/student/notifications";
  const audience = isClient ? "client" : "student";
  const messagesPath = isClient ? "/client/messages" : "/student/messages";

  useEffect(() => {
    if (!user?.id) {
      setUnreadMessages(0);
      return undefined;
    }
    let active = true;
    const refresh = () => {
      totalUnreadMessages()
        .then((n) => {
          if (active) setUnreadMessages(n);
        })
        .catch(() => {
          if (active) setUnreadMessages(0);
        });
    };
    refresh();
    const unsub = subscribeMessages(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="flex">
        <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r skl-border p-5">
          <div className="flex items-center justify-between mb-8 gap-2">
            <Link to="/" className="flex items-center gap-2 min-w-0" data-testid="sidebar-logo">
              <div className="h-7 w-7 rounded-lg bg-black text-white grid place-items-center font-display font-bold text-sm shrink-0">
                S
              </div>
              <span className="font-display font-semibold tracking-tight text-[17px]">Skilleraa</span>
            </Link>
            <NotificationBell inboxPath={notificationsPath} audience={audience} />
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto" data-testid="dashboard-sidebar-nav" aria-label="Dashboard">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                data-testid={`sidebar-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    isActive
                      ? "bg-black text-white"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-black"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={16} aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {item.to === messagesPath && unreadMessages > 0 && (
                      <span
                        className={`text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] grid place-items-center px-1 ${
                          isActive ? "bg-white text-black" : "bg-black text-white"
                        }`}
                        data-testid="sidebar-messages-unread"
                      >
                        {unreadMessages > 99 ? "99+" : unreadMessages}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 pt-4 border-t skl-border">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div
                className="h-9 w-9 rounded-full bg-black text-white grid place-items-center font-display font-semibold"
                aria-hidden
              >
                {user?.avatar_letter || "U"}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user?.name || "Demo User"}</div>
                <div className="text-xs text-neutral-500 truncate">{user?.email || "offline demo"}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                await logout();
                nav("/");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100 hover:text-black transition"
              data-testid="sidebar-logout-btn"
            >
              <LogOut size={16} aria-hidden />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="lg:hidden sticky top-0 z-30 bg-white/85 backdrop-blur border-b skl-border px-5 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-black text-white grid place-items-center font-display font-bold text-xs">
                S
              </div>
              <span className="font-display font-semibold text-sm">Skilleraa</span>
            </Link>
            <div className="flex items-center gap-2">
              <NotificationBell inboxPath={notificationsPath} audience={audience} />
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  nav("/");
                }}
                className={`${btnGhost} !text-[11px]`}
                data-testid="mobile-sidebar-logout"
              >
                Log out
              </button>
            </div>
          </div>

          <nav
            className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur border-t skl-border flex items-center justify-around py-2 px-1 overflow-x-auto"
            aria-label="Mobile dashboard"
          >
            {items.slice(0, 5).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] shrink-0 ${
                    isActive ? "text-black" : "text-neutral-500"
                  }`
                }
              >
                <item.icon size={16} aria-hidden />
                <span className="truncate max-w-[64px]">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-10 py-8 lg:py-12 pb-24 lg:pb-12">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {(title || actions) && (
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
                  <div>
                    {title && (
                      <h1 className="font-display text-3xl md:text-4xl tracking-tight" data-testid="page-title">
                        {title}
                      </h1>
                    )}
                  </div>
                  {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
                </div>
              )}
              {children}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}

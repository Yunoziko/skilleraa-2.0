import { NavLink, Link, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const studentNav = [
  { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/jobs", label: "Browse Jobs", icon: Search },
  { to: "/student/applied", label: "Applied Jobs", icon: FileText },
  { to: "/student/saved", label: "Saved Jobs", icon: Bookmark },
  { to: "/student/notifications", label: "Notifications", icon: Bell },
  { to: "/student/profile", label: "Profile", icon: User },
  { to: "/student/settings", label: "Settings", icon: Settings },
];

const clientNav = [
  { to: "/client", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/client/post", label: "Post Job", icon: PlusSquare },
  { to: "/client/jobs", label: "My Jobs", icon: Briefcase },
  { to: "/client/applicants", label: "Applicants", icon: Users },
  { to: "/client/messages", label: "Messages", icon: Bell },
  { to: "/client/profile", label: "Company Profile", icon: Building2 },
  { to: "/client/settings", label: "Settings", icon: Settings },
];

export default function DashboardShell({ children, title, actions }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = user?.role === "client" ? clientNav : studentNav;

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r skl-border p-5">
          <Link to="/" className="flex items-center gap-2 mb-8" data-testid="sidebar-logo">
            <div className="h-7 w-7 rounded-lg bg-black text-white grid place-items-center font-display font-bold text-sm">
              S
            </div>
            <span className="font-display font-semibold tracking-tight text-[17px]">Skilleraa</span>
          </Link>

          <nav className="flex-1 space-y-0.5" data-testid="dashboard-sidebar-nav">
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
                <item.icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 pt-4 border-t skl-border">
            <div className="flex items-center gap-3 mb-3 px-2">
              <div className="h-9 w-9 rounded-full bg-black text-white grid place-items-center font-display font-semibold">
                {user?.avatar_letter || "U"}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user?.name}</div>
                <div className="text-xs text-neutral-500 truncate">{user?.email}</div>
              </div>
            </div>
            <button
              onClick={async () => {
                await logout();
                nav("/");
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-600 hover:bg-neutral-100 hover:text-black transition"
              data-testid="sidebar-logout-btn"
            >
              <LogOut size={16} />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="lg:hidden sticky top-0 z-30 bg-white/85 backdrop-blur border-b skl-border px-5 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-black text-white grid place-items-center font-display font-bold text-xs">
                S
              </div>
              <span className="font-display font-semibold text-sm">Skilleraa</span>
            </Link>
            <button
              onClick={async () => {
                await logout();
                nav("/");
              }}
              className="text-xs text-neutral-600"
              data-testid="mobile-sidebar-logout"
            >
              Log out
            </button>
          </div>

          {/* Mobile bottom tabs */}
          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur border-t skl-border flex items-center justify-around py-2">
            {items.slice(0, 5).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[10px] ${
                    isActive ? "text-black" : "text-neutral-500"
                  }`
                }
              >
                <item.icon size={16} />
                <span className="truncate max-w-[60px]">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="max-w-6xl mx-auto px-5 lg:px-10 py-8 lg:py-12 pb-24 lg:pb-12">
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
                  {actions && <div className="flex items-center gap-2">{actions}</div>}
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

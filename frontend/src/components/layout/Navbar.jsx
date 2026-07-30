import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import { isSupabaseConfigured } from "@/lib/supabase";

const links = [
  { to: "/jobs", label: "Find Jobs" },
  { to: "/post-job", label: "Post Job" },
  { to: "/about", label: "About" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  const isClient = user && user !== false && user.role === "client";
  const dashboardPath = isClient ? "/client" : "/student";
  const notificationsPath = isClient ? "/client/notifications" : "/student/notifications";
  const showBell = Boolean(user && user !== false) || !isSupabaseConfigured;

  return (
    <header
      className="sticky top-0 z-40 w-full backdrop-blur-xl bg-white/75 border-b skl-border"
      data-testid="site-navbar"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-10 h-16">
        <Link
          to="/"
          className="flex items-center gap-2 group"
          data-testid="navbar-logo-link"
        >
          <div className="h-7 w-7 rounded-lg bg-black text-white grid place-items-center font-display font-bold text-sm">
            S
          </div>
          <span className="font-display font-semibold tracking-tight text-[17px]">
            Skilleraa
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={`nav-link-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `px-3 py-1.5 text-sm rounded-full transition-colors ${
                  isActive
                    ? "text-black bg-neutral-100"
                    : "text-neutral-600 hover:text-black hover:bg-neutral-50"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {showBell && (
            <NotificationBell
              inboxPath={notificationsPath}
              audience={isClient ? "client" : "student"}
            />
          )}
          {user && user !== false ? (
            <>
              <Link
                to={dashboardPath}
                className="px-4 py-2 text-sm rounded-full border skl-border hover:bg-neutral-50 transition"
                data-testid="navbar-dashboard-btn"
              >
                Dashboard
              </Link>
              <button type="button"
                onClick={async () => {
                  await logout();
                  nav("/");
                }}
                className="px-4 py-2 text-sm rounded-full bg-black text-white hover:bg-black/90 transition"
                data-testid="navbar-logout-btn"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-sm text-neutral-700 hover:text-black transition"
                data-testid="navbar-login-link"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 text-sm rounded-full bg-black text-white hover:bg-black/90 transition"
                data-testid="navbar-signup-link"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          {showBell && (
            <NotificationBell
              inboxPath={notificationsPath}
              audience={isClient ? "client" : "student"}
            />
          )}
          <button
            type="button"
            className="p-2"
            onClick={() => setOpen(!open)}
            data-testid="navbar-mobile-toggle"
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden border-t skl-border bg-white"
        >
          <div className="px-6 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2 rounded-lg text-sm hover:bg-neutral-50"
                data-testid={`mobile-nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {l.label}
              </Link>
            ))}
            <div className="h-px bg-neutral-200 my-2" />
            {user && user !== false ? (
              <>
                <Link
                  to={dashboardPath}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm hover:bg-neutral-50"
                >
                  Dashboard
                </Link>
                <button type="button"
                  onClick={async () => {
                    await logout();
                    setOpen(false);
                    nav("/");
                  }}
                  className="text-left px-3 py-2 rounded-lg text-sm hover:bg-neutral-50"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm hover:bg-neutral-50"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm bg-black text-white text-center"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </motion.div>
      )}
    </header>
  );
}

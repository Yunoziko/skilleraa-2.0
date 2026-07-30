/**
 * Local notifications store (auth/backend paused).
 * Each item has audience: "student" | "client" | "all"
 */

const KEY = "skl_mock_notifications";
const EVENT = "skl-notifications-changed";
const VERSION_KEY = "skl_mock_notifications_v";
const VERSION = 2;

const SEED = [
  {
    id: "n1",
    title: "Application received",
    body: "Your application to “React Landing Page for EdTech Product” is pending review.",
    type: "application",
    href: "/student/applied",
    audience: "student",
    created_at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    read: false,
  },
  {
    id: "n2",
    title: "New message",
    body: "Northstar Labs sent you a message about Brand Identity.",
    type: "message",
    href: "/student/messages",
    audience: "student",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    read: false,
  },
  {
    id: "n3",
    title: "Job status update",
    body: "“SEO Blog Series for SaaS Tool” was marked In Progress.",
    type: "job",
    href: "/jobs",
    audience: "all",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    read: true,
  },
  {
    id: "n4",
    title: "Profile tip",
    body: "Add portfolio links to improve your match rate with clients.",
    type: "system",
    href: "/student/profile/edit",
    audience: "student",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    read: true,
  },
  {
    id: "n5",
    title: "Applicant update",
    body: "Demo Student applied to one of your open roles.",
    type: "application",
    href: "/client/applicants",
    audience: "client",
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    read: false,
  },
  {
    id: "n6",
    title: "Order delivered",
    body: "A freelancer submitted delivery on “Brand Identity for Campus Startup”.",
    type: "project",
    href: "/client/orders",
    audience: "client",
    created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
    read: false,
  },
];

function inferAudience(n) {
  if (n.audience) return n.audience;
  const href = n.href || "";
  if (href.startsWith("/client")) return "client";
  if (href.startsWith("/student")) return "student";
  return "all";
}

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

function ensureSeeded() {
  try {
    const ver = localStorage.getItem(VERSION_KEY);
    if (ver !== String(VERSION)) {
      writeAll(SEED.map((n) => ({ ...n })));
      localStorage.setItem(VERSION_KEY, String(VERSION));
      return SEED.map((n) => ({ ...n }));
    }
  } catch {
    /* ignore */
  }
  const existing = readRaw();
  if (existing && existing.length) {
    return existing.map((n) => ({ ...n, audience: inferAudience(n) }));
  }
  writeAll(SEED.map((n) => ({ ...n })));
  try {
    localStorage.setItem(VERSION_KEY, String(VERSION));
  } catch {
    /* ignore */
  }
  return SEED.map((n) => ({ ...n }));
}

function matchesAudience(n, role) {
  const audience = inferAudience(n);
  if (!role || role === "all") return true;
  return audience === "all" || audience === role;
}

export function subscribeNotifications(callback) {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => callback();
  const onStorage = (e) => {
    if (e.key === KEY) callback();
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function listNotifications(role) {
  return ensureSeeded()
    .filter((n) => matchesAudience(n, role))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function unreadNotificationCount(role) {
  return listNotifications(role).filter((n) => !n.read).length;
}

export function markNotificationRead(id) {
  const list = ensureSeeded().map((n) => (n.id === id ? { ...n, read: true } : n));
  writeAll(list);
  return list;
}

export function markAllNotificationsRead(role) {
  const list = ensureSeeded().map((n) =>
    matchesAudience(n, role) ? { ...n, read: true } : n
  );
  writeAll(list);
  return list;
}

export function formatNotificationTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

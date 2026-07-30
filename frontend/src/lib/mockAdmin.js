/**
 * Offline admin dashboard store (auth/backend paused).
 * Keys: users, deleted jobs, reports, platform settings.
 */

import { MOCK_JOBS } from "@/data/mockJobs";
import { applyJobStatusOverrides, setMockJobStatus, subscribeJobs } from "@/lib/mockJobsStore";
import { displayJobStatus, normalizeJobStatus } from "@/lib/jobStatus";
import { listProjects, subscribeProjects } from "@/lib/mockProjects";

const USERS_KEY = "skl_mock_admin_users";
const DELETED_JOBS_KEY = "skl_mock_admin_deleted_jobs";
const REPORTS_KEY = "skl_mock_admin_reports";
const SETTINGS_KEY = "skl_mock_admin_settings";
const EVENT = "skl-admin-changed";

const SEED_USERS = [
  {
    id: "demo-student",
    role: "student",
    name: "Aarav Sharma",
    email: "student@skilleraa.demo",
    location: "Bengaluru, India",
    status: "active",
    joined_at: "2026-03-12T10:00:00.000Z",
  },
  {
    id: "u-student-2",
    role: "student",
    name: "Meera Kapoor",
    email: "meera@skilleraa.demo",
    location: "Delhi, India",
    status: "active",
    joined_at: "2026-04-02T09:00:00.000Z",
  },
  {
    id: "u-student-3",
    role: "student",
    name: "Rohan Iyer",
    email: "rohan@skilleraa.demo",
    location: "Pune, India",
    status: "suspended",
    joined_at: "2026-02-18T14:00:00.000Z",
  },
  {
    id: "u-student-4",
    role: "student",
    name: "Ananya Desai",
    email: "ananya@skilleraa.demo",
    location: "Hyderabad, India",
    status: "active",
    joined_at: "2026-05-21T11:00:00.000Z",
  },
  {
    id: "u-student-5",
    role: "student",
    name: "Kabir Singh",
    email: "kabir@skilleraa.demo",
    location: "Chandigarh, India",
    status: "active",
    joined_at: "2026-06-08T16:00:00.000Z",
  },
  {
    id: "demo-client",
    role: "client",
    name: "Priya Mehta",
    email: "client@skilleraa.demo",
    company: "Northstar Labs",
    location: "Mumbai, India",
    status: "active",
    joined_at: "2026-01-20T10:00:00.000Z",
  },
  {
    id: "u-client-2",
    role: "client",
    name: "Vikram Shah",
    email: "vikram@learnly.demo",
    company: "Learnly",
    location: "Bengaluru, India",
    status: "active",
    joined_at: "2026-02-05T08:00:00.000Z",
  },
  {
    id: "u-client-3",
    role: "client",
    name: "Sara Khan",
    email: "sara@flowdesk.demo",
    company: "Flowdesk",
    location: "Remote",
    status: "active",
    joined_at: "2026-03-30T12:00:00.000Z",
  },
  {
    id: "u-client-4",
    role: "client",
    name: "Dev Patel",
    email: "dev@clipform.demo",
    company: "Clipform",
    location: "Ahmedabad, India",
    status: "suspended",
    joined_at: "2026-04-14T15:00:00.000Z",
  },
];

const SEED_REPORTS = [
  {
    id: "rep-1",
    type: "user",
    target_id: "u-student-3",
    target_label: "Rohan Iyer",
    reason: "Spam applications across unrelated jobs",
    reporter: "Northstar Labs",
    status: "open",
    created_at: "2026-07-25T10:00:00.000Z",
  },
  {
    id: "rep-2",
    type: "user",
    target_id: "u-client-4",
    target_label: "Dev Patel (Clipform)",
    reason: "Non-payment complaint from freelancer",
    reporter: "Meera Kapoor",
    status: "open",
    created_at: "2026-07-27T14:30:00.000Z",
  },
  {
    id: "rep-3",
    type: "job",
    target_id: "mock-job-5",
    target_label: "Instagram Growth Campaign",
    reason: "Suspected scam — asks for free work sample then ghosting",
    reporter: "Aarav Sharma",
    status: "open",
    created_at: "2026-07-26T09:15:00.000Z",
  },
  {
    id: "rep-4",
    type: "job",
    target_id: "mock-job-7",
    target_label: "UI Redesign for Student Dashboard",
    reason: "Duplicate / misleading budget",
    reporter: "Ananya Desai",
    status: "open",
    created_at: "2026-07-28T11:00:00.000Z",
  },
  {
    id: "rep-5",
    type: "user",
    target_id: "u-student-2",
    target_label: "Meera Kapoor",
    reason: "Plagiarized portfolio (resolved earlier)",
    reporter: "Learnly",
    status: "resolved",
    created_at: "2026-07-10T08:00:00.000Z",
    resolved_at: "2026-07-12T10:00:00.000Z",
  },
];

const DEFAULT_SETTINGS = {
  new_signups_enabled: true,
  job_posting_enabled: true,
  applications_enabled: true,
  messaging_enabled: true,
  reviews_enabled: true,
  maintenance_mode: false,
  require_email_verify: true,
  featured_jobs_enabled: true,
};

const ANALYTICS = {
  jobs_by_category: [
    { name: "Design", value: 28 },
    { name: "Development", value: 34 },
    { name: "Writing", value: 18 },
    { name: "Marketing", value: 14 },
    { name: "Video", value: 9 },
    { name: "Other", value: 6 },
  ],
  monthly_signups: [
    { month: "Feb", students: 42, clients: 12 },
    { month: "Mar", students: 58, clients: 18 },
    { month: "Apr", students: 71, clients: 22 },
    { month: "May", students: 64, clients: 19 },
    { month: "Jun", students: 88, clients: 27 },
    { month: "Jul", students: 96, clients: 31 },
  ],
  monthly_completed: [
    { month: "Feb", completed: 18 },
    { month: "Mar", completed: 24 },
    { month: "Apr", completed: 31 },
    { month: "May", completed: 28 },
    { month: "Jun", completed: 39 },
    { month: "Jul", completed: 44 },
  ],
};

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  emit();
}

function ensureUsers() {
  const existing = readJson(USERS_KEY, null);
  if (Array.isArray(existing) && existing.length) return existing;
  writeJson(USERS_KEY, SEED_USERS);
  return [...SEED_USERS];
}

function ensureReports() {
  const existing = readJson(REPORTS_KEY, null);
  if (Array.isArray(existing) && existing.length) return existing;
  writeJson(REPORTS_KEY, SEED_REPORTS);
  return [...SEED_REPORTS];
}

function ensureSettings() {
  const existing = readJson(SETTINGS_KEY, null);
  if (existing && typeof existing === "object") return { ...DEFAULT_SETTINGS, ...existing };
  writeJson(SETTINGS_KEY, DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS };
}

function deletedJobIds() {
  const ids = readJson(DELETED_JOBS_KEY, []);
  return Array.isArray(ids) ? ids : [];
}

export function subscribeAdmin(callback) {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => callback();
  const onStorage = (e) => {
    if (
      e.key === USERS_KEY ||
      e.key === DELETED_JOBS_KEY ||
      e.key === REPORTS_KEY ||
      e.key === SETTINGS_KEY
    ) {
      callback();
    }
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  const unJobs = subscribeJobs(callback);
  const unProjects = subscribeProjects(callback);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
    unJobs();
    unProjects();
  };
}

/* ——— Users ——— */

export function listAdminUsers({ role = "all", status = "all", q = "" } = {}) {
  const query = (q || "").trim().toLowerCase();
  return ensureUsers()
    .filter((u) => {
      if (role !== "all" && u.role !== role) return false;
      if (status !== "all" && u.status !== status) return false;
      if (query) {
        const hay = [u.name, u.email, u.company, u.location, u.role].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.joined_at) - new Date(a.joined_at));
}

export function suspendUser(id) {
  const all = ensureUsers();
  const idx = all.findIndex((u) => u.id === id);
  if (idx < 0) throw new Error("User not found");
  all[idx] = { ...all[idx], status: "suspended" };
  writeJson(USERS_KEY, all);
  return all[idx];
}

export function restoreUser(id) {
  const all = ensureUsers();
  const idx = all.findIndex((u) => u.id === id);
  if (idx < 0) throw new Error("User not found");
  all[idx] = { ...all[idx], status: "active" };
  writeJson(USERS_KEY, all);
  return all[idx];
}

/* ——— Jobs ——— */

export function listAdminJobs({ status = "all", category = "all", q = "" } = {}) {
  const deleted = new Set(deletedJobIds());
  const query = (q || "").trim().toLowerCase();
  return applyJobStatusOverrides(MOCK_JOBS)
    .filter((j) => !deleted.has(j.id))
    .filter((j) => {
      if (status !== "all" && normalizeJobStatus(j.status) !== status) return false;
      if (category !== "all" && j.category !== category) return false;
      if (query) {
        const hay = [j.title, j.company_name, j.category, j.description].join(" ").toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getAdminJobCategories() {
  return [...new Set(MOCK_JOBS.map((j) => j.category).filter(Boolean))].sort();
}

export function adminCloseJob(id) {
  const deleted = new Set(deletedJobIds());
  if (deleted.has(id)) throw new Error("Job was deleted");
  setMockJobStatus(id, "closed");
  emit();
  return "closed";
}

export function adminDeleteJob(id) {
  const ids = deletedJobIds();
  if (!ids.includes(id)) {
    writeJson(DELETED_JOBS_KEY, [...ids, id]);
  } else {
    emit();
  }
  return true;
}

/* ——— Reports ——— */

export function listAdminReports({ type = "all", status = "open" } = {}) {
  return ensureReports()
    .filter((r) => {
      if (type !== "all" && r.type !== type) return false;
      if (status !== "all" && r.status !== status) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function resolveReport(id) {
  const all = ensureReports();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Report not found");
  all[idx] = {
    ...all[idx],
    status: "resolved",
    resolved_at: new Date().toISOString(),
  };
  writeJson(REPORTS_KEY, all);
  return all[idx];
}

export function dismissReport(id) {
  const all = ensureReports();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Report not found");
  all[idx] = {
    ...all[idx],
    status: "dismissed",
    resolved_at: new Date().toISOString(),
  };
  writeJson(REPORTS_KEY, all);
  return all[idx];
}

/* ——— Overview / analytics / settings ——— */

export function getAdminOverview() {
  const users = ensureUsers();
  const students = users.filter((u) => u.role === "student").length;
  const clients = users.filter((u) => u.role === "client").length;
  const jobs = listAdminJobs().length;
  const projects = listProjects();
  const activeProjects = projects.filter((p) =>
    ["pending", "active", "delivered", "revision"].includes(p.status)
  ).length;
  const completedProjects = projects.filter((p) => p.status === "completed").length;
  // Mock revenue: ₹4,500 average per completed project + open pipeline
  const revenue = completedProjects * 4500 + activeProjects * 1200 + jobs * 350;

  return {
    total_students: students,
    total_clients: clients,
    total_jobs: jobs,
    active_projects: activeProjects,
    completed_projects: completedProjects,
    revenue,
    open_reports: ensureReports().filter((r) => r.status === "open").length,
    suspended_users: users.filter((u) => u.status === "suspended").length,
  };
}

export function getAdminAnalytics() {
  return ANALYTICS;
}

export function getAdminSettings() {
  return ensureSettings();
}

export function updateAdminSetting(key, value) {
  const next = { ...ensureSettings(), [key]: Boolean(value) };
  writeJson(SETTINGS_KEY, next);
  return next;
}

export function formatAdminDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatRevenue(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

export { displayJobStatus };

/**
 * Local project / order management (auth/backend paused).
 */

import { DEMO_CLIENT_PROFILE_ID, DEMO_STUDENT_PROFILE_ID, getMyMockProfile } from "@/lib/mockProfiles";

const KEY = "skl_mock_projects";
const EVENT = "skl-projects-changed";

export const PROJECT_STATUSES = [
  "pending",
  "active",
  "delivered",
  "revision",
  "completed",
];

export const PROJECT_STATUS_LABELS = {
  pending: "Pending",
  active: "Active",
  delivered: "Pending Approval",
  revision: "Revision Requested",
  completed: "Completed",
};

const SEED = [
  {
    id: "proj-1",
    title: "Brand Identity for Campus Startup",
    job_id: "mock-job-1",
    student_id: DEMO_STUDENT_PROFILE_ID,
    student_name: "Aarav Sharma",
    client_id: DEMO_CLIENT_PROFILE_ID,
    client_name: "Northstar Labs",
    status: "active",
    budget: "₹12,000",
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8).toISOString(),
    progress: 55,
    description: "Logo, color system, and social templates in Figma.",
    files: [
      { id: "f1", name: "brief.pdf", size: "240 KB" },
      { id: "f2", name: "brand-refs.zip", size: "4.1 MB" },
    ],
    timeline: [
      { status: "pending", at: "2026-07-10T09:00:00.000Z", note: "Order created" },
      { status: "active", at: "2026-07-11T11:00:00.000Z", note: "Work started" },
    ],
    created_at: "2026-07-10T09:00:00.000Z",
    updated_at: "2026-07-11T11:00:00.000Z",
  },
  {
    id: "proj-2",
    title: "React Landing Page for EdTech Product",
    job_id: "mock-job-2",
    student_id: DEMO_STUDENT_PROFILE_ID,
    student_name: "Aarav Sharma",
    client_id: "mock-client-2",
    client_name: "Learnly",
    status: "pending",
    budget: "₹18,000",
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
    progress: 0,
    description: "Marketing landing page with waitlist form.",
    files: [{ id: "f3", name: "wireframes.fig", size: "1.2 MB" }],
    timeline: [
      { status: "pending", at: "2026-07-28T08:00:00.000Z", note: "Awaiting kickoff" },
    ],
    created_at: "2026-07-28T08:00:00.000Z",
    updated_at: "2026-07-28T08:00:00.000Z",
  },
  {
    id: "proj-3",
    title: "Product Demo Video Edit",
    job_id: "mock-job-4",
    student_id: DEMO_STUDENT_PROFILE_ID,
    student_name: "Aarav Sharma",
    client_id: "mock-client-4",
    client_name: "Clipform",
    status: "delivered",
    budget: "₹15,000",
    due_date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    progress: 100,
    description: "60–90s product demo with captions.",
    files: [
      { id: "f4", name: "raw-footage.zip", size: "820 MB" },
      { id: "f5", name: "demo-v1.mp4", size: "48 MB" },
    ],
    timeline: [
      { status: "pending", at: "2026-07-15T10:00:00.000Z", note: "Order created" },
      { status: "active", at: "2026-07-16T09:00:00.000Z", note: "Editing started" },
      { status: "delivered", at: "2026-07-29T16:00:00.000Z", note: "Delivery submitted" },
    ],
    created_at: "2026-07-15T10:00:00.000Z",
    updated_at: "2026-07-29T16:00:00.000Z",
  },
  {
    id: "proj-4",
    title: "SEO Blog Series for SaaS Tool",
    job_id: "mock-job-3",
    student_id: DEMO_STUDENT_PROFILE_ID,
    student_name: "Aarav Sharma",
    client_id: "mock-client-3",
    client_name: "Flowdesk",
    status: "revision",
    budget: "₹8,000",
    due_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString(),
    progress: 80,
    description: "Four long-form SEO articles.",
    files: [
      { id: "f6", name: "article-1.docx", size: "88 KB" },
      { id: "f7", name: "keywords.csv", size: "12 KB" },
    ],
    timeline: [
      { status: "pending", at: "2026-07-08T12:00:00.000Z", note: "Order created" },
      { status: "active", at: "2026-07-09T10:00:00.000Z", note: "Writing started" },
      { status: "delivered", at: "2026-07-24T15:00:00.000Z", note: "First draft delivered" },
      { status: "revision", at: "2026-07-26T11:00:00.000Z", note: "Revision requested" },
    ],
    created_at: "2026-07-08T12:00:00.000Z",
    updated_at: "2026-07-26T11:00:00.000Z",
  },
  {
    id: "proj-5",
    title: "Case Study Ghostwriting",
    job_id: "mock-job-8",
    student_id: DEMO_STUDENT_PROFILE_ID,
    student_name: "Aarav Sharma",
    client_id: "mock-client-8",
    client_name: "Harbor CRM",
    status: "completed",
    budget: "₹6,500",
    due_date: "2026-07-20T00:00:00.000Z",
    progress: 100,
    description: "Customer case study for the website.",
    files: [
      { id: "f8", name: "interview-notes.md", size: "16 KB" },
      { id: "f9", name: "case-study-final.pdf", size: "320 KB" },
    ],
    timeline: [
      { status: "pending", at: "2026-07-01T09:00:00.000Z", note: "Order created" },
      { status: "active", at: "2026-07-02T10:00:00.000Z", note: "Drafting" },
      { status: "delivered", at: "2026-07-18T14:00:00.000Z", note: "Delivery submitted" },
      { status: "completed", at: "2026-07-19T09:00:00.000Z", note: "Accepted & completed" },
    ],
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-19T09:00:00.000Z",
  },
];

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
  const existing = readRaw();
  if (existing && existing.length) return existing;
  const seed = JSON.parse(JSON.stringify(SEED));
  writeAll(seed);
  return seed;
}

function pushTimeline(project, status, note) {
  const entry = { status, at: new Date().toISOString(), note };
  return {
    ...project,
    status,
    updated_at: entry.at,
    timeline: [...(project.timeline || []), entry],
  };
}

export function subscribeProjects(callback) {
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

export function displayProjectStatus(status) {
  return PROJECT_STATUS_LABELS[status] || status || "Pending";
}

export function listProjects() {
  return ensureSeeded().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export function getProject(id) {
  return listProjects().find((p) => p.id === id) || null;
}

export function listStudentProjects(studentId = DEMO_STUDENT_PROFILE_ID) {
  return listProjects().filter((p) => p.student_id === studentId);
}

export function listClientOrders(clientId = DEMO_CLIENT_PROFILE_ID) {
  const all = listProjects();
  if (!clientId) return [];
  return all.filter((p) => p.client_id === clientId);
}

export function groupStudentProjects(projects) {
  const list = projects || [];
  return {
    pending: list.filter((p) => p.status === "pending"),
    active: list.filter((p) => p.status === "active" || p.status === "revision" || p.status === "delivered"),
    completed: list.filter((p) => p.status === "completed"),
  };
}

export function groupClientOrders(orders) {
  const list = orders || [];
  return {
    active: list.filter((p) => p.status === "active" || p.status === "revision" || p.status === "pending"),
    pendingApproval: list.filter((p) => p.status === "delivered"),
    completed: list.filter((p) => p.status === "completed"),
  };
}

function updateProject(id, mutator) {
  const all = ensureSeeded();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error("Project not found");
  const next = mutator(all[idx]);
  all[idx] = next;
  writeAll(all);
  return next;
}

/** Student starts work on a pending project. */
export function startProject(id) {
  return updateProject(id, (p) => {
    if (p.status !== "pending") throw new Error("Only pending projects can be started");
    return { ...pushTimeline(p, "active", "Work started"), progress: Math.max(p.progress || 0, 10) };
  });
}

/** Student delivers work (from active or revision). */
export function deliverWork(id) {
  return updateProject(id, (p) => {
    if (p.status !== "active" && p.status !== "revision") {
      throw new Error("You can only deliver active or revision projects");
    }
    return { ...pushTimeline(p, "delivered", "Delivery submitted"), progress: 100 };
  });
}

/** Client accepts delivery → completed. */
export function acceptDelivery(id) {
  return updateProject(id, (p) => {
    if (p.status !== "delivered") throw new Error("No delivery to accept");
    return { ...pushTimeline(p, "completed", "Delivery accepted"), progress: 100 };
  });
}

/** Client requests revision. */
export function requestRevision(id, note = "Revision requested") {
  return updateProject(id, (p) => {
    if (p.status !== "delivered") throw new Error("No delivery to revise");
    return { ...pushTimeline(p, "revision", note), progress: Math.min(p.progress || 90, 90) };
  });
}

/** Client marks complete from active (skip delivery flow). */
export function markComplete(id) {
  return updateProject(id, (p) => {
    if (p.status === "completed") return p;
    return { ...pushTimeline(p, "completed", "Marked complete by client"), progress: 100 };
  });
}

export function formatProjectDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function daysUntilDue(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function getDefaultParties() {
  const student = getMyMockProfile("student");
  const client = getMyMockProfile("client");
  return { student, client };
}

/**
 * Local mock applications storage for when the backend/DB is unavailable.
 * Does not touch auth or Supabase — uses demo identities when no user is logged in.
 */

import { getMockJobById, MOCK_JOBS } from "@/data/mockJobs";

const STORAGE_KEY = "skl_mock_applications";
const EVENT = "skl-applications-changed";

export const DEMO_STUDENT = {
  id: "demo-student",
  name: "Demo Student",
  email: "student@skilleraa.demo",
  role: "student",
  headline: "Full-stack learner · Skilleraa",
  skills: ["React", "Figma", "Writing"],
  avatar_letter: "D",
  portfolio_url: "",
};

export const DEMO_CLIENT = {
  id: "demo-client",
  name: "Demo Client",
  email: "client@skilleraa.demo",
  role: "client",
  avatar_letter: "C",
};

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(apps) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

/** Subscribe to local application changes (same tab + other tabs). */
export function subscribeApplications(callback) {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => callback();
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) callback();
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function displayApplicationStatus(status) {
  const s = (status || "pending").toLowerCase();
  if (s === "accepted" || s === "hired" || s === "shortlisted") return "Accepted";
  if (s === "rejected") return "Rejected";
  return "Pending";
}

export function resolveApplicantStudent(user) {
  if (user && user !== false && user.role === "student") {
    return {
      id: user.id,
      name: user.name || "Student",
      email: user.email || "",
      role: "student",
      headline: user.headline || "",
      skills: user.skills || [],
      avatar_letter: user.avatar_letter || (user.name || "S")[0].toUpperCase(),
      portfolio_url: user.portfolio_url || "",
    };
  }
  return { ...DEMO_STUDENT };
}

function embedJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    title: job.title,
    category: job.category,
    company_name: job.company_name,
    company_letter: job.company_letter,
    budget: job.budget,
    duration: job.duration,
    status: job.status || "open",
  };
}

export function listMockApplications() {
  return readAll().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function listMyMockApplications(studentId) {
  const sid = studentId || DEMO_STUDENT.id;
  return listMockApplications().filter((a) => a.student_id === sid);
}

export function listMockApplicants() {
  return listMockApplications();
}

export function hasMockApplied(jobId, studentId) {
  const sid = studentId || DEMO_STUDENT.id;
  return readAll().some((a) => a.job_id === jobId && a.student_id === sid);
}

/**
 * Create a local application. Throws if already applied or validation fails upstream.
 */
export function createMockApplication({
  job,
  jobId,
  coverLetter,
  expectedBudget,
  deliveryTime,
  portfolioUrl = "",
  student,
}) {
  const resolvedJob = job || getMockJobById(jobId) || MOCK_JOBS.find((j) => j.id === jobId);
  if (!resolvedJob && !jobId) {
    throw new Error("Job not found");
  }

  const studentProfile = student || DEMO_STUDENT;
  const jid = resolvedJob?.id || jobId;

  if (hasMockApplied(jid, studentProfile.id)) {
    throw new Error("You have already applied to this job");
  }

  const app = {
    id: `mock-app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    job_id: jid,
    student_id: studentProfile.id,
    cover_letter: coverLetter.trim(),
    expected_budget: expectedBudget.trim(),
    delivery_time: deliveryTime.trim(),
    portfolio_url: (portfolioUrl || "").trim(),
    status: "pending",
    created_at: new Date().toISOString(),
    job: embedJob(resolvedJob) || {
      id: jid,
      title: "Job",
      company_name: "Skilleraa Client",
      company_letter: "S",
    },
    student: {
      id: studentProfile.id,
      name: studentProfile.name,
      email: studentProfile.email,
      headline: studentProfile.headline || "",
      skills: studentProfile.skills || [],
      avatar_letter: studentProfile.avatar_letter || (studentProfile.name || "?")[0].toUpperCase(),
      portfolio_url: studentProfile.portfolio_url || "",
    },
  };

  const all = readAll();
  all.unshift(app);
  writeAll(all);
  return app;
}

export function updateMockApplicationStatus(id, status) {
  const normalized =
    status === "hired" || status === "shortlisted" || status === "accepted"
      ? "accepted"
      : status === "rejected"
        ? "rejected"
        : "pending";

  const all = readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("Application not found");
  all[idx] = { ...all[idx], status: normalized };
  writeAll(all);
  return all[idx];
}

/** Build dashboard-friendly stats from local applications for a student. */
export function mockStudentApplicationStats(studentId) {
  const apps = listMyMockApplications(studentId);
  return {
    applications: apps.length,
    pending: apps.filter((a) => displayApplicationStatus(a.status) === "Pending").length,
    accepted: apps.filter((a) => displayApplicationStatus(a.status) === "Accepted").length,
    rejected: apps.filter((a) => displayApplicationStatus(a.status) === "Rejected").length,
  };
}

export function mockClientApplicationStats() {
  const apps = listMockApplicants();
  return {
    applications: apps.length,
    hired: apps.filter((a) => displayApplicationStatus(a.status) === "Accepted").length,
  };
}

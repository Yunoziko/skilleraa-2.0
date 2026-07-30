/**
 * Local reviews & ratings (auth/backend paused).
 */

import { listMockClientJobs } from "@/lib/mockJobsStore";
import { normalizeJobStatus } from "@/lib/jobStatus";
import {
  DEMO_CLIENT_PROFILE_ID,
  DEMO_STUDENT_PROFILE_ID,
  getMyMockProfile,
} from "@/lib/mockProfiles";

const KEY = "skl_mock_reviews";
const EVENT = "skl-reviews-changed";

const SEED = [
  {
    id: "rev-1",
    student_id: DEMO_STUDENT_PROFILE_ID,
    student_name: "Aarav Sharma",
    client_id: DEMO_CLIENT_PROFILE_ID,
    client_name: "Northstar Labs",
    job_id: "mock-job-1",
    project_name: "Brand Identity for Campus Startup",
    rating: 5,
    comment:
      "Aarav delivered a polished brand kit ahead of schedule. Clear communication and strong Figma craft.",
    created_at: "2026-07-12T10:00:00.000Z",
    updated_at: "2026-07-12T10:00:00.000Z",
  },
  {
    id: "rev-2",
    student_id: DEMO_STUDENT_PROFILE_ID,
    student_name: "Aarav Sharma",
    client_id: "mock-client-2",
    client_name: "Learnly",
    job_id: "mock-job-2",
    project_name: "React Landing Page for EdTech Product",
    rating: 4,
    comment:
      "Solid landing page and responsive layout. A few polish passes would make it perfect.",
    created_at: "2026-07-18T14:30:00.000Z",
    updated_at: "2026-07-18T14:30:00.000Z",
  },
  {
    id: "rev-3",
    student_id: DEMO_STUDENT_PROFILE_ID,
    student_name: "Aarav Sharma",
    client_id: "mock-client-3",
    client_name: "Flowdesk",
    job_id: "mock-job-3",
    project_name: "SEO Blog Series for SaaS Tool",
    rating: 5,
    comment: "Excellent research and writing quality. Easy to publish as-is.",
    created_at: "2026-07-22T09:15:00.000Z",
    updated_at: "2026-07-22T09:15:00.000Z",
  },
  {
    id: "rev-4",
    student_id: DEMO_STUDENT_PROFILE_ID,
    student_name: "Aarav Sharma",
    client_id: "mock-client-4",
    client_name: "Clipform",
    job_id: "mock-job-4",
    project_name: "Product Demo Video Edit",
    rating: 3,
    comment: "Good first cut. Needed clearer pacing notes next time.",
    created_at: "2026-07-25T16:00:00.000Z",
    updated_at: "2026-07-25T16:00:00.000Z",
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
  const seed = SEED.map((r) => ({ ...r }));
  writeAll(seed);
  return seed;
}

export function subscribeReviews(callback) {
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

export function listAllReviews() {
  return ensureSeeded().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function listReviewsForStudent(studentId = DEMO_STUDENT_PROFILE_ID) {
  return listAllReviews().filter((r) => r.student_id === studentId);
}

export function listReviewsByClient(clientId = DEMO_CLIENT_PROFILE_ID) {
  return listAllReviews().filter((r) => r.client_id === clientId);
}

export function getReviewById(id) {
  return listAllReviews().find((r) => r.id === id) || null;
}

export function getReviewForJobByClient(jobId, clientId = DEMO_CLIENT_PROFILE_ID) {
  return listAllReviews().find((r) => r.job_id === jobId && r.client_id === clientId) || null;
}

export function computeRatingStats(reviews) {
  const list = reviews || [];
  const total = list.length;
  if (!total) {
    return {
      average: 0,
      total: 0,
      breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  list.forEach((r) => {
    const rating = Math.min(5, Math.max(1, Number(r.rating) || 0));
    sum += rating;
    breakdown[rating] = (breakdown[rating] || 0) + 1;
  });
  return {
    average: Math.round((sum / total) * 10) / 10,
    total,
    breakdown,
  };
}

/** Completed jobs the client can still review (or already reviewed). */
export function listCompletableProjectsForClient(clientId = DEMO_CLIENT_PROFILE_ID) {
  const jobs = listMockClientJobs().filter((j) => normalizeJobStatus(j.status) === "completed");
  return jobs.map((j) => ({
    job: j,
    existing: getReviewForJobByClient(j.id, clientId),
  }));
}

export function createReview({
  job,
  rating,
  comment,
  clientId = DEMO_CLIENT_PROFILE_ID,
  studentId = DEMO_STUDENT_PROFILE_ID,
}) {
  const stars = Math.min(5, Math.max(1, Number(rating) || 0));
  if (!stars) throw new Error("Rating is required");
  if (!(comment || "").trim()) throw new Error("Comment is required");
  if (!job?.id) throw new Error("Project is required");

  if (getReviewForJobByClient(job.id, clientId)) {
    throw new Error("You already reviewed this project");
  }

  const client = getMyMockProfile("client");
  const student = getMyMockProfile("student");
  const now = new Date().toISOString();
  const review = {
    id: `rev-${Date.now()}`,
    student_id: studentId,
    student_name: student.name,
    client_id: clientId,
    client_name: client.company_name || client.name,
    job_id: job.id,
    project_name: job.title,
    rating: stars,
    comment: comment.trim(),
    created_at: now,
    updated_at: now,
  };
  const all = ensureSeeded();
  all.unshift(review);
  writeAll(all);
  return review;
}

export function updateReview(id, { rating, comment }) {
  const all = ensureSeeded();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Review not found");
  const stars = Math.min(5, Math.max(1, Number(rating) || all[idx].rating));
  if (!(comment || "").trim()) throw new Error("Comment is required");
  all[idx] = {
    ...all[idx],
    rating: stars,
    comment: comment.trim(),
    updated_at: new Date().toISOString(),
  };
  writeAll(all);
  return all[idx];
}

export function deleteReview(id) {
  const all = ensureSeeded().filter((r) => r.id !== id);
  writeAll(all);
  return true;
}

export function formatReviewDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

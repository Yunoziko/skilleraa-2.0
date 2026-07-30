/**
 * Local user/company profiles when the backend is unavailable.
 * Does not touch AuthContext — demos use stable local IDs.
 */

import { listMockClientJobs } from "@/lib/mockJobsStore";
import { isPubliclyListed } from "@/lib/jobStatus";

const KEY = "skl_mock_profiles";
const EVENT = "skl-profiles-changed";

export const DEMO_STUDENT_PROFILE_ID = "demo-student";
export const DEMO_CLIENT_PROFILE_ID = "demo-client";

export const DEFAULT_STUDENT_PROFILE = {
  id: DEMO_STUDENT_PROFILE_ID,
  role: "student",
  name: "Aarav Sharma",
  email: "student@skilleraa.demo",
  headline: "Full-stack learner · React & product design",
  bio: "I build clean interfaces and ship small products end-to-end. Looking for remote freelance work that sharpens real skills.",
  location: "Bengaluru, India",
  skills: ["React", "Tailwind", "Figma", "Node.js", "MongoDB"],
  education: "B.Tech Computer Science · 2026",
  experience:
    "• Built 3 campus product MVPs (React + FastAPI)\n• Design intern — redesigned a student dashboard in Figma\n• Freelance landing pages for two early startups",
  portfolio_url: "https://aarav.demo",
  portfolio_links: ["https://aarav.demo", "https://github.com/demo-aarav"],
  resume_url: "",
  resume_filename: "Aarav_Sharma_Resume.pdf",
  availability: "available", // available | limited | unavailable
  avatar_letter: "A",
};

export const DEFAULT_CLIENT_PROFILE = {
  id: DEMO_CLIENT_PROFILE_ID,
  role: "client",
  name: "Priya Mehta",
  email: "client@skilleraa.demo",
  company_name: "Northstar Labs",
  company_website: "https://northstar.demo",
  company_description:
    "Northstar Labs helps early-stage teams ship marketing sites and internal tools with student talent.",
  location: "Mumbai, India",
  industry: "SaaS / EdTech",
  company_size: "11–50",
  headline: "",
  bio: "",
  skills: [],
  avatar_letter: "N",
};

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map) {
  localStorage.setItem(KEY, JSON.stringify(map));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function subscribeProfiles(callback) {
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

function withDefaults(role, stored) {
  const base = role === "client" ? DEFAULT_CLIENT_PROFILE : DEFAULT_STUDENT_PROFILE;
  const merged = { ...base, ...(stored || {}) };
  merged.avatar_letter = (
    merged.company_name ||
    merged.name ||
    base.avatar_letter ||
    "?"
  )[0].toUpperCase();
  if (typeof merged.skills === "string") {
    merged.skills = merged.skills.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(merged.skills)) merged.skills = [];
  if (!Array.isArray(merged.portfolio_links)) {
    merged.portfolio_links = merged.portfolio_url ? [merged.portfolio_url] : [];
  }
  return merged;
}

export function getMockProfile(id, roleHint) {
  const map = readAll();
  const stored = map[id];
  if (stored) return withDefaults(stored.role || roleHint || "student", stored);

  if (id === DEMO_STUDENT_PROFILE_ID || roleHint === "student") {
    return withDefaults("student", map[DEMO_STUDENT_PROFILE_ID]);
  }
  if (id === DEMO_CLIENT_PROFILE_ID || roleHint === "client") {
    return withDefaults("client", map[DEMO_CLIENT_PROFILE_ID]);
  }
  // Unknown id — still return a readable student demo so public pages never blank
  return withDefaults(roleHint || "student", { id, name: "Skilleraa User" });
}

export function getMyMockProfile(role = "student") {
  const id = role === "client" ? DEMO_CLIENT_PROFILE_ID : DEMO_STUDENT_PROFILE_ID;
  return getMockProfile(id, role);
}

export function saveMockProfile(profile) {
  const role = profile.role === "client" ? "client" : "student";
  const id = profile.id || (role === "client" ? DEMO_CLIENT_PROFILE_ID : DEMO_STUDENT_PROFILE_ID);
  const next = withDefaults(role, { ...profile, id, role });
  const map = readAll();
  map[id] = next;
  writeAll(map);
  return next;
}

export function displayAvailability(status) {
  const s = (status || "available").toLowerCase();
  if (s === "limited") return "Limited";
  if (s === "unavailable") return "Unavailable";
  return "Available";
}

/** Active (open) jobs for a client public/profile view from mock job store. */
export function getMockActiveJobsForClient(clientId) {
  return listMockClientJobs().filter((j) => isPubliclyListed(j.status));
}

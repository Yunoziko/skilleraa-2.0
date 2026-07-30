/**
 * Local saved-jobs store for when the backend is unavailable.
 */

import { getMockJobById, MOCK_JOBS } from "@/data/mockJobs";
import { applyJobStatusOverrides } from "@/lib/mockJobsStore";

const KEY = "skl_mock_saved_jobs";
const EVENT = "skl-saved-changed";

function readIds() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  localStorage.setItem(KEY, JSON.stringify([...new Set(ids.map(String))]));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function subscribeSavedJobs(callback) {
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

export function listMockSavedIds() {
  return readIds();
}

export function isMockSaved(jobId) {
  return readIds().includes(String(jobId));
}

/** Toggle save. Returns { saved: boolean }. */
export function toggleMockSave(jobId) {
  const id = String(jobId);
  const ids = readIds();
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    ids.splice(idx, 1);
    writeIds(ids);
    return { saved: false };
  }
  ids.push(id);
  writeIds(ids);
  return { saved: true };
}

export function listMockSavedJobs() {
  const ids = readIds();
  const byId = new Map(applyJobStatusOverrides(MOCK_JOBS).map((j) => [j.id, j]));
  return ids
    .map((id) => byId.get(id) || getMockJobById(id))
    .filter(Boolean);
}

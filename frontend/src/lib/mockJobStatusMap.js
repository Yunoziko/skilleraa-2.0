/** Local status overrides for mock jobs (no job data imports — avoids cycles). */

const STATUS_KEY = "skl_mock_job_statuses";
const EVENT = "skl-jobs-changed";

export function readJobStatusMap() {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STATUS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeJobStatusMap(map) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(map));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

export function subscribeJobs(callback) {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => callback();
  const onStorage = (e) => {
    if (e.key === STATUS_KEY) callback();
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function applyStatusMap(jobs, normalize) {
  const map = readJobStatusMap();
  return (jobs || []).map((j) => {
    const override = map[j.id];
    if (!override) return normalize ? { ...j, status: normalize(j.status) } : { ...j };
    return { ...j, status: normalize ? normalize(override) : override };
  });
}

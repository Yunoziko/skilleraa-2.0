/** Canonical job workflow statuses for Skilleraa. */

export const JOB_STATUSES = ["open", "in_progress", "completed", "cancelled", "closed"];

export const JOB_STATUS_LABELS = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  closed: "Closed",
};

export function normalizeJobStatus(status) {
  const s = (status || "open").toLowerCase().replace(/\s+/g, "_");
  if (s === "in-progress") return "in_progress";
  if (JOB_STATUSES.includes(s)) return s;
  return "open";
}

export function displayJobStatus(status) {
  return JOB_STATUS_LABELS[normalizeJobStatus(status)] || "Open";
}

/** Browse / public listings only show open jobs. */
export function isPubliclyListed(status) {
  return normalizeJobStatus(status) === "open";
}

export function isClosedLike(status) {
  const s = normalizeJobStatus(status);
  return s === "closed" || s === "cancelled" || s === "completed";
}

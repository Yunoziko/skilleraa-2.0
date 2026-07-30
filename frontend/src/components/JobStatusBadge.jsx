import { displayJobStatus, normalizeJobStatus } from "@/lib/jobStatus";

const TONE = {
  open: "bg-white text-black border-black",
  in_progress: "bg-neutral-100 text-black border-neutral-300",
  completed: "bg-neutral-50 text-neutral-700 border-neutral-200",
  cancelled: "bg-neutral-50 text-neutral-500 border-neutral-200",
  closed: "bg-neutral-50 text-neutral-500 border-neutral-200",
};

export default function JobStatusBadge({ status, className = "" }) {
  const key = normalizeJobStatus(status);
  return (
    <span
      className={`text-[10px] uppercase tracking-widest font-semibold border px-2 py-1 rounded-full ${TONE[key] || TONE.open} ${className}`}
      data-testid="job-status-badge"
    >
      {displayJobStatus(key)}
    </span>
  );
}

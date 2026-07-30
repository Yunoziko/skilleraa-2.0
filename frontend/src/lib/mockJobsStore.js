/**
 * Local job status overrides + client "my jobs" when the API is unavailable.
 */

import { MOCK_JOBS } from "@/data/mockJobs";
import { normalizeJobStatus, isClosedLike } from "@/lib/jobStatus";
import {
  applyStatusMap,
  readJobStatusMap,
  writeJobStatusMap,
  subscribeJobs,
} from "@/lib/mockJobStatusMap";

export { subscribeJobs };

export function applyJobStatusOverrides(jobs) {
  return applyStatusMap(jobs, normalizeJobStatus);
}

export function setMockJobStatus(jobId, status) {
  const map = readJobStatusMap();
  map[jobId] = normalizeJobStatus(status);
  writeJobStatusMap(map);
  return map[jobId];
}

/** Client "my jobs" fallback — all sample jobs with local status overrides. */
export function listMockClientJobs() {
  return applyJobStatusOverrides(MOCK_JOBS);
}

export function mockClientJobStats(jobs) {
  const list = jobs || listMockClientJobs();
  const total = list.length;
  const open = list.filter((j) => normalizeJobStatus(j.status) === "open").length;
  const closed = list.filter((j) => isClosedLike(j.status)).length;
  const inProgress = list.filter((j) => normalizeJobStatus(j.status) === "in_progress").length;
  return { total_jobs: total, open_jobs: open, closed_jobs: closed, in_progress_jobs: inProgress };
}

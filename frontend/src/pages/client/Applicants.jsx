import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import api from "@/lib/api";
import { Users, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  displayApplicationStatus,
  listMockApplicants,
  subscribeApplications,
  updateMockApplicationStatus,
} from "@/lib/mockApplications";
import { fetchMyJobs } from "@/lib/jobsService";

export default function Applicants() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMatches, setAiMatches] = useState([]);
  const [aiTriggered, setAiTriggered] = useState(false);

  const load = () => {
    api
      .get("/applicants/all")
      .then((r) => {
        const remote = Array.isArray(r.data) ? r.data : [];
        const local = listMockApplicants();
        const remoteIds = new Set(remote.map((a) => a.id));
        setApps([...remote, ...local.filter((a) => !remoteIds.has(a.id))]);
        setUsingMock(false);
      })
      .catch(() => {
        setApps(listMockApplicants());
        setUsingMock(true);
      })
      .finally(() => setLoading(false));

    fetchMyJobs()
      .then((list) => {
        setJobs(list);
        if (list.length > 0 && !selectedJob) setSelectedJob(list[0].id);
      })
      .catch(() => setJobs([]));
  };

  useEffect(() => {
    load();
    return subscribeApplications(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = async (id) => {
    try {
      if (!usingMock) {
        try {
          await api.put(`/applications/${id}/status`, { status: "hired" });
        } catch {
          updateMockApplicationStatus(id, "accepted");
        }
      } else {
        updateMockApplicationStatus(id, "accepted");
      }
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: "accepted" } : a)));
      toast.success("Application accepted");
      load();
    } catch {
      toast.error("Failed to update");
    }
  };

  const reject = async (id) => {
    try {
      if (!usingMock) {
        try {
          await api.put(`/applications/${id}/status`, { status: "rejected" });
        } catch {
          updateMockApplicationStatus(id, "rejected");
        }
      } else {
        updateMockApplicationStatus(id, "rejected");
      }
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: "rejected" } : a)));
      toast.success("Application rejected");
      load();
    } catch {
      toast.error("Failed to update");
    }
  };

  const runAi = async () => {
    if (!selectedJob) return;
    setAiLoading(true);
    try {
      const { data } = await api.post(`/ai/match-applicants/${selectedJob}`);
      setAiMatches(data.matches || []);
      setAiTriggered(true);
      if ((data.matches || []).length === 0) toast("No applicants to rank for this job yet.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "AI matching failed");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <DashboardShell title="Applicants">
      {jobs.length > 0 && (
        <div className="mb-6 rounded-2xl border skl-border p-6" data-testid="ai-rank-panel">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-black text-white grid place-items-center">
                <Sparkles size={14} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-lg font-semibold">AI Applicant Ranking</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border skl-border font-mono uppercase tracking-widest">Claude</span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">Pick a job and get the top 5 fits, ranked automatically.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedJob}
                onChange={(e) => {
                  setSelectedJob(e.target.value);
                  setAiTriggered(false);
                  setAiMatches([]);
                }}
                aria-label="Select job for AI ranking"
                className="border skl-border rounded-full px-4 py-2 text-sm bg-white focus:outline-none focus:border-black min-w-[220px]"
                data-testid="ai-job-select"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
              <button type="button"
                onClick={runAi}
                disabled={aiLoading || !selectedJob}
                className="inline-flex items-center gap-2 bg-black text-white text-sm px-4 py-2 rounded-full hover:bg-black/90 disabled:opacity-60 active:scale-95 transition"
                data-testid="ai-rank-btn"
              >
                {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiLoading ? "Ranking…" : aiTriggered ? "Re-rank" : "Rank applicants"}
              </button>
            </div>
          </div>

          {aiTriggered && !aiLoading && (
            <div className="mt-5 border-t skl-border pt-5 space-y-2">
              {aiMatches.length === 0 ? (
                <p className="text-sm text-neutral-500">No ranked applicants for this job yet.</p>
              ) : (
                aiMatches.map((m, i) => (
                  <div key={m.application.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border skl-border hover:bg-neutral-50 transition" data-testid={`ai-rank-${m.application.id}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="font-display text-lg font-medium w-8 text-neutral-400">#{i + 1}</div>
                      <div className="h-9 w-9 rounded-full bg-black text-white grid place-items-center font-display font-semibold text-sm">
                        {m.application.student?.avatar_letter || "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{m.application.student?.name}</div>
                        <p className="text-xs text-neutral-600 italic truncate">“{m.reason}”</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-xl font-medium tracking-tighter">{m.score}</div>
                      <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-semibold">Score</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border skl-border bg-neutral-50 animate-pulse" />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          title="No applicants yet"
          description="Once students apply to your jobs, you'll see them here."
          ctaLabel="Browse Jobs"
          ctaTo="/jobs"
          icon={Users}
        />
      ) : (
        <div className="space-y-3">
          {apps.map((a) => {
            const label = displayApplicationStatus(a.status);
            return (
              <div key={a.id} className="border skl-border rounded-2xl p-5" data-testid={`applicant-${a.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-full bg-black text-white grid place-items-center font-display font-semibold">
                      {a.student?.avatar_letter || "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{a.student?.name || "Applicant"}</div>
                      <div className="text-xs text-neutral-500">{a.student?.headline || "—"}</div>
                      <div className="mt-2 text-sm text-neutral-700">
                        Applied to{" "}
                        <Link to={`/jobs/${a.job_id}`} className="underline underline-offset-4">
                          {a.job?.title || "Job"}
                        </Link>
                        {a.created_at && (
                          <span className="text-neutral-500"> · {new Date(a.created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                      {a.cover_letter && (
                        <p className="mt-3 text-sm text-neutral-700 bg-neutral-50 border skl-border rounded-xl p-3 whitespace-pre-line">
                          {a.cover_letter}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">
                        {a.expected_budget && (
                          <span className="border skl-border rounded-full px-2.5 py-1">Budget: {a.expected_budget}</span>
                        )}
                        {a.delivery_time && (
                          <span className="border skl-border rounded-full px-2.5 py-1">Delivery: {a.delivery_time}</span>
                        )}
                        {a.portfolio_url && (
                          <a
                            href={a.portfolio_url.startsWith("http") ? a.portfolio_url : `https://${a.portfolio_url}`}
                            target="_blank"
                            rel="noreferrer"
                            className="border skl-border rounded-full px-2.5 py-1 hover:bg-neutral-50"
                          >
                            Portfolio
                          </a>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(a.student?.skills || []).slice(0, 6).map((s) => (
                          <span key={s} className="text-[11px] px-2 py-0.5 rounded-full border skl-border">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                      {label}
                    </span>
                    {label === "Pending" && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        <button type="button"
                          onClick={() => accept(a.id)}
                          className="text-[11px] px-3 py-1.5 rounded-full bg-black text-white hover:bg-black/90"
                          data-testid={`applicant-${a.id}-accept`}
                        >
                          Accept
                        </button>
                        <button type="button"
                          onClick={() => reject(a.id)}
                          className="text-[11px] px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                          data-testid={`applicant-${a.id}-reject`}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardShell>
  );
}

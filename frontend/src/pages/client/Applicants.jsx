import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import api from "@/lib/api";
import { Users, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["pending", "shortlisted", "hired", "rejected"];

export default function Applicants() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMatches, setAiMatches] = useState([]);
  const [aiTriggered, setAiTriggered] = useState(false);

  const load = () => {
    api.get("/applicants/all").then((r) => setApps(r.data)).finally(() => setLoading(false));
    api.get("/jobs/mine").then((r) => {
      setJobs(r.data);
      if (r.data.length > 0 && !selectedJob) setSelectedJob(r.data[0].id);
    }).catch(() => {});
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/applications/${id}/status`, { status });
      toast.success(`Marked as ${status}`);
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
      {/* AI Ranking Panel */}
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
                className="border skl-border rounded-full px-4 py-2 text-sm bg-white focus:outline-none focus:border-black min-w-[220px]"
                data-testid="ai-job-select"
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
              <button
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
          ctaLabel="Post a Job"
          ctaTo="/client/post"
          icon={Users}
        />
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <div key={a.id} className="border skl-border rounded-2xl p-5" data-testid={`applicant-${a.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-full bg-black text-white grid place-items-center font-display font-semibold">
                    {a.student?.avatar_letter || "?"}
                  </div>
                  <div className="min-w-0">
                    <Link to={`/u/${a.student_id}`} className="font-medium hover:underline">
                      {a.student?.name}
                    </Link>
                    <div className="text-xs text-neutral-500">{a.student?.headline || "—"}</div>
                    <div className="mt-2 text-sm text-neutral-700">
                      Applied to <Link to={`/jobs/${a.job_id}`} className="underline underline-offset-4">{a.job?.title}</Link>
                    </div>
                    {a.cover_letter && (
                      <p className="mt-3 text-sm text-neutral-700 bg-neutral-50 border skl-border rounded-xl p-3 whitespace-pre-line">
                        {a.cover_letter}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(a.student?.skills || []).slice(0, 6).map((s) => (
                        <span key={s} className="text-[11px] px-2 py-0.5 rounded-full border skl-border">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                    {a.status}
                  </span>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[220px]">
                    {STATUSES.filter((s) => s !== a.status).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(a.id, s)}
                        className="text-[11px] px-2.5 py-1 rounded-full border skl-border hover:bg-neutral-50 capitalize"
                        data-testid={`applicant-${a.id}-status-${s}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

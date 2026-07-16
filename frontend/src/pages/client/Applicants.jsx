import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import api from "@/lib/api";
import { Users } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["pending", "shortlisted", "hired", "rejected"];

export default function Applicants() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get("/applicants/all").then((r) => setApps(r.data)).finally(() => setLoading(false));
  };
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

  return (
    <DashboardShell title="Applicants">
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

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import api from "@/lib/api";
import { Briefcase, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function MyJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/jobs/mine").then((r) => setJobs(r.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const del = async (id) => {
    if (!window.confirm("Delete this job posting? This cannot be undone.")) return;
    try {
      await api.delete(`/jobs/${id}`);
      toast.success("Job deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <DashboardShell
      title="My Jobs"
      actions={
        <Link
          to="/client/post"
          className="bg-black text-white text-sm px-5 py-2.5 rounded-full hover:bg-black/90"
          data-testid="myjobs-post-new"
        >
          Post New Job
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl border skl-border bg-neutral-50 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No jobs posted yet"
          description="Post your first job to start receiving applications from talented students."
          ctaLabel="Post a Job"
          ctaTo="/client/post"
          icon={Briefcase}
        />
      ) : (
        <div className="border skl-border rounded-2xl divide-y divide-neutral-200 overflow-hidden">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between p-5 hover:bg-neutral-50 transition" data-testid={`myjob-row-${j.id}`}>
              <Link to={`/jobs/${j.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                <div className="h-10 w-10 rounded-xl bg-black text-white grid place-items-center font-display font-semibold">
                  {j.company_letter}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{j.title}</div>
                  <div className="text-xs text-neutral-500 truncate">
                    {j.category} · {j.budget} · {j.duration}
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-3 ml-3 shrink-0">
                <Link
                  to="/client/applicants"
                  className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full hover:bg-white"
                >
                  {j.applications_count || 0} applicants
                </Link>
                <button
                  onClick={() => del(j.id)}
                  className="p-2 rounded-full border skl-border hover:bg-white text-neutral-600"
                  aria-label="Delete job"
                  data-testid={`myjob-delete-${j.id}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

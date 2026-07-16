import { useEffect, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import JobCard from "@/components/JobCard";
import EmptyState from "@/components/EmptyState";
import api from "@/lib/api";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";

export default function SavedJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());

  const load = () => {
    api.get("/jobs/saved/list").then((r) => {
      setJobs(r.data);
      setSavedIds(new Set(r.data.map((j) => j.id)));
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleSave = async (id) => {
    try {
      const { data } = await api.post(`/jobs/${id}/save`);
      toast.success(data.saved ? "Saved" : "Removed");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <DashboardShell title="Saved Jobs">
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl border skl-border bg-neutral-50 animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          title="No saved jobs"
          description="Save interesting jobs to review them later."
          ctaLabel="Browse Jobs"
          ctaTo="/jobs"
          icon={Bookmark}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((j, i) => (
            <JobCard key={j.id} job={j} index={i} onSave={toggleSave} saved={savedIds.has(j.id)} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

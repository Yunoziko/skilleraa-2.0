import { useEffect, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import JobCard from "@/components/JobCard";
import EmptyState from "@/components/EmptyState";
import { JobCardSkeletonGrid } from "@/components/Skeleton";
import api from "@/lib/api";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import {
  listMockSavedJobs,
  listMockSavedIds,
  subscribeSavedJobs,
  toggleMockSave,
} from "@/lib/mockSavedJobs";

export default function SavedJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState(new Set());

  const load = () => {
    setLoading(true);
    const localJobs = listMockSavedJobs();
    const localIds = listMockSavedIds();
    api
      .get("/jobs/saved/list")
      .then((r) => {
        const remote = Array.isArray(r.data) ? r.data : [];
        const remoteIds = new Set(remote.map((j) => j.id));
        const merged = [...remote, ...localJobs.filter((j) => !remoteIds.has(j.id))];
        setJobs(merged);
        setSavedIds(new Set([...remote.map((j) => j.id), ...localIds]));
      })
      .catch(() => {
        setJobs(localJobs);
        setSavedIds(new Set(localIds));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    return subscribeSavedJobs(load);
  }, []);

  const toggleSave = async (id) => {
    try {
      try {
        const { data } = await api.post(`/jobs/${id}/save`);
        toast.success(data.saved ? "Job saved" : "Removed from saved");
      } catch {
        const { saved } = toggleMockSave(id);
        toast.success(saved ? "Job saved" : "Removed from saved");
      }
      load();
    } catch {
      toast.error("Could not update saved jobs. Try again.");
    }
  };

  return (
    <DashboardShell title="Saved Jobs">
      {loading ? (
        <JobCardSkeletonGrid count={3} />
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

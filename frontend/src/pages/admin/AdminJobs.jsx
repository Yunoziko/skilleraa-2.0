import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Briefcase } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/layout/AdminShell";
import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import { JOB_STATUSES, displayJobStatus } from "@/lib/jobStatus";
import {
  adminCloseJob,
  adminDeleteJob,
  formatAdminDate,
  getAdminJobCategories,
  listAdminJobs,
  subscribeAdmin,
} from "@/lib/mockAdmin";

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const categories = getAdminJobCategories();

  const load = () => {
    setJobs(listAdminJobs({ status, category, q }));
    setLoading(false);
  };

  useEffect(() => {
    load();
    return subscribeAdmin(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category, q]);

  const onClose = (id) => {
    try {
      adminCloseJob(id);
      toast.success("Job closed");
      load();
    } catch (e) {
      toast.error(e.message || "Could not close job");
    }
  };

  const onDelete = (id, title) => {
    if (!window.confirm(`Delete “${title}”? This is a mock delete (local only).`)) return;
    try {
      adminDeleteJob(id);
      toast.success("Job deleted (mock)");
      load();
    } catch (e) {
      toast.error(e.message || "Could not delete");
    }
  };

  return (
    <AdminShell title="Jobs">
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search jobs…"
            className="w-full border skl-border rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black"
            data-testid="admin-jobs-search"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border skl-border rounded-full px-4 py-2.5 text-sm bg-white outline-none"
          data-testid="admin-jobs-status-filter"
        >
          <option value="all">All statuses</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {displayJobStatus(s)}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border skl-border rounded-full px-4 py-2.5 text-sm bg-white outline-none"
          data-testid="admin-jobs-category-filter"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <ListRowSkeleton count={5} />
      ) : jobs.length === 0 ? (
        <EmptyState title="No jobs found" description="Try another search or filter." icon={Briefcase} />
      ) : (
        <div className="space-y-3" data-testid="admin-jobs-list">
          {jobs.map((j) => (
            <div
              key={j.id}
              className="border skl-border rounded-2xl p-5 flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/jobs/${j.id}`} className="font-medium hover:underline underline-offset-4">
                    {j.title}
                  </Link>
                  <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-0.5 rounded-full">
                    {displayJobStatus(j.status)}
                  </span>
                  <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-0.5 rounded-full text-neutral-500">
                    {j.category}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {j.company_name} · {j.budget} · Posted {formatAdminDate(j.created_at)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {j.status !== "closed" && j.status !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => onClose(j.id)}
                    className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                    data-testid={`close-job-${j.id}`}
                  >
                    Close job
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(j.id, j.title)}
                  className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50 text-neutral-700"
                  data-testid={`delete-job-${j.id}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

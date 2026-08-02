import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import { Briefcase, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  deliverWork,
  displayProjectStatus,
  formatProjectDate,
  groupStudentProjects,
  listStudentProjects,
  startProject,
  subscribeProjects,
} from "@/lib/mockProjects";
import { useAuth } from "@/context/AuthContext";

const TABS = [
  { key: "active", label: "Active Projects" },
  { key: "pending", label: "Pending Projects" },
  { key: "completed", label: "Completed Projects" },
];

export default function StudentProjects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");

  const load = () => {
    setProjects(listStudentProjects(user?.id || ""));
    setLoading(false);
  };

  useEffect(() => {
    load();
    return subscribeProjects(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const groups = useMemo(() => groupStudentProjects(projects), [projects]);
  const visible = groups[tab] || [];

  const onStart = (id) => {
    try {
      startProject(id);
      toast.success("Project started");
      load();
    } catch (e) {
      toast.error(e.message || "Could not start project");
    }
  };

  const onDeliver = (id) => {
    try {
      deliverWork(id);
      toast.success("Work delivered — awaiting client approval");
      load();
    } catch (e) {
      toast.error(e.message || "Could not deliver");
    }
  };

  return (
    <DashboardShell title="My Projects">
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`text-xs px-4 py-2 rounded-full border transition ${
              tab === t.key ? "bg-black text-white border-black" : "skl-border hover:bg-neutral-50"
            }`}
            data-testid={`projects-tab-${t.key}`}
          >
            {t.label} ({groups[t.key]?.length || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <ListRowSkeleton count={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          title={`No ${TABS.find((t) => t.key === tab)?.label.toLowerCase() || "projects"}`}
          description="Projects appear here when a client hires you."
          icon={Briefcase}
          ctaLabel="Browse Jobs"
          ctaTo="/jobs"
        />
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <div
              key={p.id}
              className="border skl-border rounded-2xl p-5"
              data-testid={`student-project-${p.id}`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/projects/${p.id}`}
                      className="font-medium hover:underline underline-offset-4"
                    >
                      {p.title}
                    </Link>
                    <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                      {displayProjectStatus(p.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {p.client_name} · Due {formatProjectDate(p.due_date)} · {p.budget}
                  </div>

                  {/* Progress */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
                      <span>Progress</span>
                      <span className="font-medium text-neutral-700">{p.progress || 0}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                      <div
                        className="h-full bg-black transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, p.progress || 0))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Link
                    to={`/projects/${p.id}`}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                  >
                    View <ArrowUpRight size={12} />
                  </Link>
                  {p.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => onStart(p.id)}
                      className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-black/90"
                    >
                      Start project
                    </button>
                  )}
                  {(p.status === "active" || p.status === "revision") && (
                    <button
                      type="button"
                      onClick={() => onDeliver(p.id)}
                      className="text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-black/90"
                      data-testid={`deliver-${p.id}`}
                    >
                      Deliver Work
                    </button>
                  )}
                  <Link
                    to={`/projects/${p.id}#files`}
                    className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                  >
                    View Files
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}

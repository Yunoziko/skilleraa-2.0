import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  FileText,
  MessageSquare,
  Star,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  acceptDelivery,
  daysUntilDue,
  deliverWork,
  displayProjectStatus,
  formatProjectDate,
  getProject,
  markComplete,
  requestRevision,
  startProject,
  subscribeProjects,
} from "@/lib/mockProjects";

const TIMELINE_ORDER = ["pending", "active", "delivered", "revision", "completed"];

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    const p = getProject(id);
    setProject(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
    return subscribeProjects(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const knownRole = user && user !== false ? user.role : null;
  const showStudentActions = knownRole === "student" || knownRole == null;
  const showClientActions = knownRole === "client" || knownRole == null;

  const run = (fn, ok) => {
    try {
      fn(id);
      toast.success(ok);
      load();
    } catch (e) {
      toast.error(e.message || "Action failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-14">
          <ListRowSkeleton count={4} />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-white text-black">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-20">
          <EmptyState
            title="Project not found"
            description="This project may have been removed."
            ctaLabel="Browse Jobs"
            ctaTo="/jobs"
            icon={Briefcase}
          />
        </div>
        <Footer />
      </div>
    );
  }

  const dueIn = daysUntilDue(project.due_date);
  const messagesPath = knownRole === "client" ? "/client/messages" : "/student/messages";
  const reviewPath =
    knownRole === "client" ? `/client/reviews?job=${project.job_id || ""}` : "/student/reviews";
  const backPath = knownRole === "client" ? "/client/orders" : "/student/projects";

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />
      <section className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
        <button
          type="button"
          onClick={() => nav(backPath)}
          className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-black"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <div className="mt-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-3xl md:text-4xl tracking-tighter font-medium">
                {project.title}
              </h1>
              <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                {displayProjectStatus(project.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-neutral-600">{project.description}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              to={messagesPath}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border skl-border hover:bg-neutral-50"
            >
              <MessageSquare size={12} /> Conversation
            </Link>
            <Link
              to={reviewPath}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border skl-border hover:bg-neutral-50"
            >
              <Star size={12} /> Review
            </Link>
          </div>
        </div>

        <div className="mt-8 grid sm:grid-cols-3 gap-3">
          <Meta icon={Wallet} label="Budget" value={project.budget} />
          <Meta
            icon={Calendar}
            label="Due date"
            value={`${formatProjectDate(project.due_date)}${
              dueIn != null ? (dueIn < 0 ? ` · ${Math.abs(dueIn)}d overdue` : ` · ${dueIn}d left`) : ""
            }`}
          />
          <Meta icon={Briefcase} label="Progress" value={`${project.progress || 0}%`} />
        </div>

        <div className="mt-4 h-2 rounded-full bg-neutral-100 overflow-hidden">
          <div
            className="h-full bg-black transition-all"
            style={{ width: `${Math.min(100, Math.max(0, project.progress || 0))}%` }}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {showStudentActions && project.status === "pending" && (
            <button
              type="button"
              onClick={() => run(startProject, "Project started")}
              className="text-sm px-4 py-2 rounded-full bg-black text-white hover:bg-black/90"
            >
              Start project
            </button>
          )}
          {showStudentActions && (project.status === "active" || project.status === "revision") && (
            <button
              type="button"
              onClick={() => run(deliverWork, "Work delivered")}
              className="text-sm px-4 py-2 rounded-full bg-black text-white hover:bg-black/90"
              data-testid="detail-deliver"
            >
              Deliver Work
            </button>
          )}
          {showClientActions && project.status === "delivered" && (
            <>
              <button
                type="button"
                onClick={() => run(acceptDelivery, "Delivery accepted")}
                className="text-sm px-4 py-2 rounded-full bg-black text-white hover:bg-black/90"
              >
                Accept Delivery
              </button>
              <button
                type="button"
                onClick={() => run(requestRevision, "Revision requested")}
                className="text-sm px-4 py-2 rounded-full border skl-border hover:bg-neutral-50"
              >
                Request Revision
              </button>
            </>
          )}
          {showClientActions && project.status !== "completed" && project.status !== "delivered" && (
            <button
              type="button"
              onClick={() => run(markComplete, "Marked complete")}
              className="text-sm px-4 py-2 rounded-full border skl-border hover:bg-neutral-50"
            >
              Mark Complete
            </button>
          )}
        </div>

        {/* Timeline */}
        <div className="mt-12 border-t skl-border pt-8">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
            Status timeline
          </div>
          <ol className="mt-6 space-y-4" data-testid="project-timeline">
            {(project.timeline || []).map((t, i) => (
              <li key={`${t.status}-${t.at}-${i}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-black mt-1.5" />
                  {i < (project.timeline || []).length - 1 && (
                    <div className="w-px flex-1 bg-neutral-200 my-1" />
                  )}
                </div>
                <div className="pb-4 min-w-0">
                  <div className="text-sm font-medium">{displayProjectStatus(t.status)}</div>
                  <div className="text-xs text-neutral-500">{formatProjectDate(t.at)}</div>
                  {t.note && <p className="mt-1 text-sm text-neutral-700">{t.note}</p>}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-4 flex flex-wrap gap-2">
            {TIMELINE_ORDER.map((s) => {
              const hit = (project.timeline || []).some((t) => t.status === s);
              return (
                <span
                  key={s}
                  className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-1 rounded-full border ${
                    hit ? "bg-black text-white border-black" : "skl-border text-neutral-400"
                  }`}
                >
                  {displayProjectStatus(s)}
                </span>
              );
            })}
          </div>
        </div>

        {/* Files */}
        <div id="files" className="mt-12 border-t skl-border pt-8 scroll-mt-24">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
            Attached files
          </div>
          <div className="mt-4 space-y-2">
            {(project.files || []).length === 0 ? (
              <p className="text-sm text-neutral-500">No files attached.</p>
            ) : (
              (project.files || []).map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 border skl-border rounded-xl px-4 py-3"
                  data-testid={`project-file-${f.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg border skl-border grid place-items-center bg-neutral-50">
                      <FileText size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{f.name}</div>
                      <div className="text-xs text-neutral-500">{f.size} · mock file</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast.message("Mock file — download unavailable offline")}
                    className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50 shrink-0"
                  >
                    View
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-10 text-sm text-neutral-500">
          {project.client_name} · {project.student_name}
        </div>
      </section>
      <Footer />
    </div>
  );
}

function Meta({ icon: Icon, label, value }) {
  return (
    <div className="border skl-border rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-500 font-semibold">
        <Icon size={12} /> {label}
      </div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

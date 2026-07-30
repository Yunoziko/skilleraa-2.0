import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import ConfirmModal from "@/components/ConfirmModal";
import StarRating from "@/components/StarRating";
import { ListRowSkeleton } from "@/components/Skeleton";
import { Star, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createReview,
  deleteReview,
  formatReviewDate,
  getReviewById,
  listCompletableProjectsForClient,
  listReviewsByClient,
  subscribeReviews,
  updateReview,
} from "@/lib/mockReviews";
import { DEMO_CLIENT_PROFILE_ID } from "@/lib/mockProfiles";
import { listMockClientJobs } from "@/lib/mockJobsStore";

export default function ClientReviews() {
  const [params] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [myReviews, setMyReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobId, setJobId] = useState(params.get("job") || "");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [formError, setFormError] = useState("");

  const load = () => {
    setProjects(listCompletableProjectsForClient(DEMO_CLIENT_PROFILE_ID));
    setMyReviews(listReviewsByClient(DEMO_CLIENT_PROFILE_ID));
    setLoading(false);
  };

  useEffect(() => {
    load();
    return subscribeReviews(load);
  }, []);

  useEffect(() => {
    const fromUrl = params.get("job");
    if (fromUrl) setJobId(fromUrl);
  }, [params]);

  useEffect(() => {
    const edit = params.get("edit");
    if (!edit) return;
    const existing = getReviewById(edit);
    if (!existing) return;
    setEditingId(existing.id);
    setJobId(existing.job_id);
    setRating(existing.rating);
    setComment(existing.comment);
  }, [params]);

  const reviewable = projects.filter((p) => !p.existing || p.existing.id === editingId);

  const resetForm = () => {
    setEditingId(null);
    setRating(5);
    setComment("");
    setFormError("");
    setJobId(params.get("job") || "");
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      if (editingId) {
        updateReview(editingId, { rating, comment });
        toast.success("Review updated");
      } else {
        const job = listMockClientJobs().find((j) => j.id === jobId);
        if (!job) throw new Error("Select a completed project");
        createReview({ job, rating, comment, clientId: DEMO_CLIENT_PROFILE_ID });
        toast.success("Review submitted");
      }
      resetForm();
      load();
    } catch (err) {
      setFormError(err.message || "Could not save review");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r) => {
    setEditingId(r.id);
    setJobId(r.job_id);
    setRating(r.rating);
    setComment(r.comment);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    try {
      deleteReview(pendingDelete);
      toast.success("Review deleted");
      if (editingId === pendingDelete) resetForm();
      setPendingDelete(null);
      load();
    } catch {
      toast.error("Could not delete review");
    }
  };

  return (
    <DashboardShell title="Reviews">
      {loading ? (
        <ListRowSkeleton count={4} />
      ) : (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <form
              onSubmit={onSubmit}
              className="border skl-border rounded-2xl p-6 space-y-4 sticky top-24"
              data-testid="leave-review-form"
            >
              <div className="font-display text-xl font-semibold">
                {editingId ? "Edit review" : "Leave a review"}
              </div>
              <p className="text-sm text-neutral-600">
                Reviews can be left after a project is marked Completed.
              </p>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Project</label>
                <select
                  required
                  value={jobId}
                  disabled={Boolean(editingId)}
                  onChange={(e) => setJobId(e.target.value)}
                  className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black bg-white disabled:opacity-60"
                  data-testid="review-job-select"
                >
                  <option value="">Select completed project…</option>
                  {(editingId ? projects : reviewable).map(({ job }) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Rating</label>
                <div className="mt-2">
                  <StarRating value={rating} onChange={setRating} size={22} />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Comment</label>
                <textarea
                  required
                  minLength={10}
                  rows={5}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share feedback about the student's work…"
                  className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black"
                  data-testid="review-comment"
                />
              </div>

              {formError && (
                <div className="text-sm bg-neutral-100 border skl-border rounded-lg px-3 py-2">{formError}</div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-black text-white rounded-full px-5 py-2.5 text-sm hover:bg-black/90 disabled:opacity-60"
                  data-testid="review-submit"
                >
                  {saving ? "Saving…" : editingId ? "Update review" : "Submit review"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-sm px-4 py-2 rounded-full border skl-border hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Your reviews</h2>
              <span className="text-xs text-neutral-500">{myReviews.length} total</span>
            </div>

            {myReviews.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                description="Complete a project, then leave feedback for the student."
                icon={Star}
                ctaLabel="My Jobs"
                ctaTo="/client/jobs"
              />
            ) : (
              myReviews.map((r) => (
                <article
                  key={r.id}
                  className="border skl-border rounded-2xl p-5"
                  data-testid={`client-review-${r.id}`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.project_name}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        For {r.student_name} · {formatReviewDate(r.updated_at || r.created_at)}
                      </div>
                    </div>
                    <StarRating value={r.rating} size={14} readOnly />
                  </div>
                  <p className="mt-3 text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{r.comment}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                      data-testid={`review-edit-${r.id}`}
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(r.id)}
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                      data-testid={`review-delete-${r.id}`}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title="Delete this review?"
        description="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </DashboardShell>
  );
}

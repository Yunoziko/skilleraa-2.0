import { useEffect, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import ReviewModal from "@/components/ReviewModal";
import StarRating from "@/components/StarRating";
import { ListRowSkeleton } from "@/components/Skeleton";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  computeRatingStats,
  createReview,
  fetchMyWrittenReviews,
  fetchProfileRating,
  fetchReviewableApplications,
  fetchReviewsForUser,
  formatReviewDate,
} from "@/lib/reviewsService";

export default function ClientReviews() {
  const { user } = useAuth();
  const [received, setReceived] = useState([]);
  const [written, setWritten] = useState([]);
  const [ratingMeta, setRatingMeta] = useState({ average_rating: 0, review_count: 0 });
  const [reviewable, setReviewable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalTarget, setModalTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [recv, mine, meta, pending] = await Promise.all([
        fetchReviewsForUser(user.id),
        fetchMyWrittenReviews(),
        fetchProfileRating(user.id),
        fetchReviewableApplications(),
      ]);
      setReceived(recv);
      setWritten(mine);
      setRatingMeta(meta);
      setReviewable(pending);
    } catch (e) {
      toast.error(e?.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const stats = computeRatingStats(received);
  const average = ratingMeta.review_count ? ratingMeta.average_rating : stats.average;
  const total = ratingMeta.review_count || stats.total;

  const onSubmitReview = async (payload) => {
    setSaving(true);
    try {
      await createReview(payload);
      toast.success("Review submitted");
      setModalTarget(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell
      title="Reviews"
      actions={
        reviewable.length > 0 ? (
          <button
            type="button"
            onClick={() => setModalTarget(reviewable[0])}
            className="bg-black text-white text-sm px-4 py-2 rounded-full hover:bg-black/90"
            data-testid="leave-review-btn"
          >
            Leave a review
          </button>
        ) : null
      }
    >
      {loading ? (
        <ListRowSkeleton count={4} />
      ) : (
        <div className="space-y-8">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="border skl-border rounded-2xl p-6 md:col-span-1">
              <div className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Average rating</div>
              <div className="mt-3 flex items-end gap-3">
                <div className="font-display text-5xl tracking-tighter font-medium" data-testid="reviews-average">
                  {total ? Number(average).toFixed(1) : "—"}
                </div>
                <div className="pb-2">
                  <StarRating value={average} size={18} readOnly />
                  <div className="text-xs text-neutral-500 mt-1" data-testid="reviews-total">
                    {total} review{total === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
            </div>
            <div className="border skl-border rounded-2xl p-6 md:col-span-2">
              <div className="text-sm text-neutral-600">
                Reviews can be left only after an application is marked <span className="font-medium text-black">Completed</span>.
                Submitted reviews cannot be edited or deleted.
              </div>
              {reviewable.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {reviewable.map((t) => (
                    <button
                      key={t.application_id}
                      type="button"
                      onClick={() => setModalTarget(t)}
                      className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                      data-testid={`reviewable-${t.application_id}`}
                    >
                      Review {t.reviewee_name} · {t.job_title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Reviews about you</h2>
              <span className="text-xs text-neutral-500">{received.length} total</span>
            </div>
            {received.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                description="When freelancers review completed work with you, it appears here."
                icon={Star}
              />
            ) : (
              <div className="space-y-3" data-testid="reviews-list">
                {received.map((r) => (
                  <article key={r.id} className="border skl-border rounded-2xl p-5" data-testid={`review-card-${r.id}`}>
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium">{r.reviewer_name}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {r.project_name} · {formatReviewDate(r.created_at)}
                        </div>
                      </div>
                      <StarRating value={r.rating} size={14} readOnly />
                    </div>
                    <p className="mt-3 text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{r.review}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Reviews you left</h2>
              <span className="text-xs text-neutral-500">{written.length} total</span>
            </div>
            {written.length === 0 ? (
              <EmptyState
                title="No reviews written"
                description="Complete a hire, mark it completed, then leave feedback for the student."
                icon={Star}
                ctaLabel="Applicants"
                ctaTo="/client/applicants"
              />
            ) : (
              <div className="space-y-3">
                {written.map((r) => (
                  <article key={r.id} className="border skl-border rounded-2xl p-5" data-testid={`client-review-${r.id}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.project_name}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">
                          For {r.reviewee_name} · {formatReviewDate(r.created_at)}
                        </div>
                      </div>
                      <StarRating value={r.rating} size={14} readOnly />
                    </div>
                    <p className="mt-3 text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{r.review}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <ReviewModal
        open={Boolean(modalTarget)}
        target={modalTarget}
        loading={saving}
        onClose={() => setModalTarget(null)}
        onSubmit={onSubmitReview}
      />
    </DashboardShell>
  );
}

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
  fetchProfileRating,
  fetchReviewableApplications,
  fetchReviewsForUser,
  formatReviewDate,
} from "@/lib/reviewsService";

export default function StudentReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [ratingMeta, setRatingMeta] = useState({ average_rating: 0, review_count: 0 });
  const [reviewable, setReviewable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalTarget, setModalTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [list, meta, pending] = await Promise.all([
        fetchReviewsForUser(user.id),
        fetchProfileRating(user.id),
        fetchReviewableApplications(),
      ]);
      setReviews(list);
      setRatingMeta(meta);
      setReviewable(pending);
    } catch (e) {
      toast.error(e?.message || "Failed to load reviews");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const stats = computeRatingStats(reviews);
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
      title="Received Reviews"
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
        <>
          {reviewable.length > 1 && (
            <div className="mb-6 border skl-border rounded-2xl p-4">
              <div className="text-sm font-medium">Ready to review</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {reviewable.map((t) => (
                  <button
                    key={t.application_id}
                    type="button"
                    onClick={() => setModalTarget(t)}
                    className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50"
                  >
                    {t.job_title} → {t.reviewee_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4 mb-8">
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
              <div className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Rating breakdown</div>
              <div className="mt-4 space-y-2" data-testid="reviews-breakdown">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = stats.breakdown[star] || 0;
                  const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-3 text-sm">
                      <div className="w-10 text-neutral-600 tabular-nums">{star}★</div>
                      <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                        <div className="h-full bg-black transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="w-8 text-right text-xs text-neutral-500 tabular-nums">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {reviews.length === 0 ? (
            <EmptyState
              title="No reviews yet"
              description="When clients leave feedback on completed projects, it will show up here."
              icon={Star}
            />
          ) : (
            <div className="space-y-3" data-testid="reviews-list">
              {reviews.map((r) => (
                <article
                  key={r.id}
                  className="border skl-border rounded-2xl p-5"
                  data-testid={`review-card-${r.id}`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium">{r.reviewer_name}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {r.project_name} · {formatReviewDate(r.created_at)}
                      </div>
                    </div>
                    <StarRating value={r.rating} size={14} readOnly />
                  </div>
                  <p className="mt-3 text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                    {r.review}
                  </p>
                </article>
              ))}
            </div>
          )}
        </>
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

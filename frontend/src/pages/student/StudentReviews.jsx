import { useEffect, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import StarRating from "@/components/StarRating";
import { ListRowSkeleton } from "@/components/Skeleton";
import { Star } from "lucide-react";
import {
  computeRatingStats,
  formatReviewDate,
  listReviewsForStudent,
  subscribeReviews,
} from "@/lib/mockReviews";
import { DEMO_STUDENT_PROFILE_ID } from "@/lib/mockProfiles";

export default function StudentReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setReviews(listReviewsForStudent(DEMO_STUDENT_PROFILE_ID));
    setLoading(false);
  };

  useEffect(() => {
    load();
    return subscribeReviews(load);
  }, []);

  const stats = computeRatingStats(reviews);

  return (
    <DashboardShell title="Received Reviews">
      {loading ? (
        <ListRowSkeleton count={4} />
      ) : (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="border skl-border rounded-2xl p-6 md:col-span-1">
              <div className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Average rating</div>
              <div className="mt-3 flex items-end gap-3">
                <div className="font-display text-5xl tracking-tighter font-medium" data-testid="reviews-average">
                  {stats.total ? stats.average.toFixed(1) : "—"}
                </div>
                <div className="pb-2">
                  <StarRating value={stats.average} size={18} readOnly />
                  <div className="text-xs text-neutral-500 mt-1">{stats.total} review{stats.total === 1 ? "" : "s"}</div>
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
                      <div className="font-medium">{r.client_name}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">
                        {r.project_name} · {formatReviewDate(r.created_at)}
                      </div>
                    </div>
                    <StarRating value={r.rating} size={14} readOnly />
                  </div>
                  <p className="mt-3 text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                    {r.comment}
                  </p>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}

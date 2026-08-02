import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { toast } from "sonner";
import AdminShell from "@/components/layout/AdminShell";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import StarRating from "@/components/StarRating";
import { ListRowSkeleton } from "@/components/Skeleton";
import { adminDeleteReview, fetchAdminReviews, formatAdminDate } from "@/lib/adminService";

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setReviews(await fetchAdminReviews());
    } catch (e) {
      setError(e?.message || "Failed to load reviews");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const list = await fetchAdminReviews();
        if (active) setReviews(list);
      } catch (e) {
        if (!active) return;
        setError(e?.message || "Failed to load reviews");
        setReviews([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const onRemove = async (id) => {
    if (!window.confirm("Remove this review? Rating averages will update automatically.")) return;
    setBusyId(id);
    try {
      await adminDeleteReview(id);
      toast.success("Review removed");
      await load();
    } catch (e) {
      toast.error(e?.message || "Could not remove review");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell title="Reviews">
      {loading ? (
        <ListRowSkeleton count={5} />
      ) : error ? (
        <ErrorState title="Couldn’t load reviews" description={error} onRetry={load} />
      ) : reviews.length === 0 ? (
        <EmptyState title="No reviews" description="Submitted reviews will appear here." icon={Star} />
      ) : (
        <div className="space-y-3" data-testid="admin-reviews-list">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="border skl-border rounded-2xl p-5 flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <StarRating value={r.rating} size={14} readOnly />
                  <span className="text-xs text-neutral-500">{formatAdminDate(r.created_at)}</span>
                </div>
                <div className="mt-2 text-sm">
                  <Link to={`/u/${r.reviewer_id}`} className="font-medium underline underline-offset-4">
                    {r.reviewer_name}
                  </Link>
                  <span className="text-neutral-500"> → </span>
                  <Link to={`/u/${r.reviewee_id}`} className="font-medium underline underline-offset-4">
                    {r.reviewee_name}
                  </Link>
                </div>
                <p className="mt-2 text-sm text-neutral-700 whitespace-pre-line">{r.review}</p>
              </div>
              <button
                type="button"
                disabled={busyId === r.id}
                onClick={() => onRemove(r.id)}
                className="text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50 shrink-0 disabled:opacity-60"
                data-testid={`delete-review-${r.id}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

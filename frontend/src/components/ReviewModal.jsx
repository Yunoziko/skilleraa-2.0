import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StarRating from "@/components/StarRating";

/**
 * Modal to leave a 1–5 star review for a completed application.
 */
export default function ReviewModal({
  open,
  target,
  loading = false,
  onSubmit,
  onClose,
}) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setRating(5);
      setReview("");
      setError("");
    }
  }, [open, target?.application_id]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!rating) {
      setError("Select a star rating.");
      return;
    }
    if (review.trim().length < 10) {
      setError("Review must be at least 10 characters.");
      return;
    }
    try {
      await onSubmit?.({
        applicationId: target.application_id,
        revieweeId: target.reviewee_id,
        rating,
        review: review.trim(),
      });
    } catch (err) {
      setError(err?.message || "Could not submit review");
    }
  };

  return (
    <AnimatePresence>
      {open && target && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid="review-modal"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
            onClick={onClose}
          />
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="relative w-full max-w-md bg-white border skl-border rounded-2xl p-6 shadow-[0_16px_48px_rgba(0,0,0,0.12)] space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
          >
            <div>
              <h2 id="review-modal-title" className="font-display text-xl font-semibold">
                Leave a review
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                For {target.reviewee_name} · {target.job_title}
              </p>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
                Rating
              </label>
              <div className="mt-2">
                <StarRating value={rating} onChange={setRating} size={22} />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
                Review
              </label>
              <textarea
                required
                minLength={10}
                rows={5}
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Share feedback about working together…"
                className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black"
                data-testid="review-modal-text"
              />
            </div>

            {error && (
              <div className="text-sm bg-neutral-100 border skl-border rounded-lg px-3 py-2" data-testid="review-modal-error">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="text-sm px-4 py-2 rounded-full border skl-border hover:bg-neutral-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-black text-white rounded-full px-5 py-2.5 text-sm hover:bg-black/90 disabled:opacity-60"
                data-testid="review-modal-submit"
              >
                {loading ? "Submitting…" : "Submit"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

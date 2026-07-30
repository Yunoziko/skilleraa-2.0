import { Star } from "lucide-react";

/**
 * Display or interactive 1–5 star rating.
 * Keep styling aligned with Skilleraa black/white UI.
 */
export default function StarRating({
  value = 0,
  onChange,
  size = 16,
  readOnly = false,
  className = "",
}) {
  const interactive = typeof onChange === "function" && !readOnly;
  const stars = [1, 2, 3, 4, 5];

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      role={interactive ? "radiogroup" : "img"}
      aria-label={`${value} out of 5 stars`}
      data-testid="star-rating"
    >
      {stars.map((n) => {
        const filled = n <= Math.round(Number(value) || 0);
        if (!interactive) {
          return (
            <Star
              key={n}
              size={size}
              className={filled ? "text-black fill-black" : "text-neutral-300"}
            />
          );
        }
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-0.5 rounded hover:scale-105 transition"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            data-testid={`star-${n}`}
          >
            <Star
              size={size}
              className={filled ? "text-black fill-black" : "text-neutral-300"}
            />
          </button>
        );
      })}
    </div>
  );
}

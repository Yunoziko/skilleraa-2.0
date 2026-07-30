import { Link } from "react-router-dom";
import { btnPrimary } from "@/lib/uiClasses";

export default function EmptyState({
  title,
  description,
  ctaLabel,
  ctaTo,
  onCtaClick,
  icon: Icon,
  compact = false,
}) {
  const showCta = Boolean(ctaLabel && (ctaTo || onCtaClick));

  return (
    <div
      className={`border skl-border rounded-2xl text-center bg-white ${
        compact ? "p-6 sm:p-8" : "p-8 sm:p-12"
      }`}
      data-testid="empty-state"
    >
      {Icon && (
        <div className="mx-auto h-12 w-12 rounded-xl border skl-border grid place-items-center mb-4">
          <Icon size={18} className="text-neutral-500" aria-hidden />
        </div>
      )}
      <h3 className="font-display text-lg sm:text-xl font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-neutral-600 max-w-md mx-auto">{description}</p>
      )}
      {showCta &&
        (onCtaClick ? (
          <button
            type="button"
            onClick={onCtaClick}
            className={`${btnPrimary} mt-6`}
            data-testid="empty-state-cta"
          >
            {ctaLabel}
          </button>
        ) : (
          <Link to={ctaTo} className={`${btnPrimary} mt-6`} data-testid="empty-state-cta">
            {ctaLabel}
          </Link>
        ))}
    </div>
  );
}

import { AlertCircle, RefreshCw } from "lucide-react";
import { btnGhostMd, btnPrimarySm } from "@/lib/uiClasses";

/**
 * Inline error panel for list/detail pages when a fetch fails.
 */
export default function ErrorState({
  title = "Something went wrong",
  description = "We couldn’t load this content. Please try again.",
  onRetry,
  secondaryLabel,
  onSecondary,
}) {
  return (
    <div
      className="border skl-border rounded-2xl p-8 sm:p-12 text-center bg-white"
      role="alert"
      data-testid="error-state"
    >
      <div className="mx-auto h-12 w-12 rounded-xl border skl-border grid place-items-center mb-4">
        <AlertCircle size={18} className="text-neutral-500" aria-hidden />
      </div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-neutral-600 max-w-md mx-auto">{description}</p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className={btnPrimarySm} data-testid="error-retry">
            <RefreshCw size={12} aria-hidden /> Try again
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button type="button" onClick={onSecondary} className={btnGhostMd} data-testid="error-secondary">
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

import { Info } from "lucide-react";

/** Subtle banner when the UI is showing local/demo data instead of the API. */
export default function DemoBanner({ message = "Showing demo data — backend unavailable." }) {
  return (
    <div
      className="mb-6 flex items-start gap-2 rounded-2xl border skl-border bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
      role="status"
      data-testid="demo-banner"
    >
      <Info size={14} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

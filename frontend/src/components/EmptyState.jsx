import { Link } from "react-router-dom";

export default function EmptyState({ title, description, ctaLabel, ctaTo, icon: Icon }) {
  return (
    <div
      className="border skl-border rounded-2xl p-12 text-center bg-white"
      data-testid="empty-state"
    >
      {Icon && (
        <div className="mx-auto h-12 w-12 rounded-xl border skl-border grid place-items-center mb-4">
          <Icon size={18} className="text-neutral-500" />
        </div>
      )}
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {description && <p className="mt-2 text-sm text-neutral-600 max-w-md mx-auto">{description}</p>}
      {ctaLabel && ctaTo && (
        <Link
          to={ctaTo}
          className="inline-flex mt-6 px-5 py-2 rounded-full bg-black text-white text-sm hover:bg-black/90 transition"
          data-testid="empty-state-cta"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

export default function StatCard({ icon: Icon, label, value, testId }) {
  const id =
    testId ||
    `stat-${String(label || "")
      .toLowerCase()
      .replace(/\s+/g, "-")}`;

  return (
    <div className="border skl-border rounded-2xl p-5" data-testid={id}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">{label}</div>
        {Icon ? <Icon size={14} className="text-neutral-400 shrink-0" aria-hidden /> : null}
      </div>
      <div className="mt-3 font-display text-2xl sm:text-3xl tracking-tighter font-medium">{value}</div>
    </div>
  );
}

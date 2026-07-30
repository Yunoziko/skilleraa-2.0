/**
 * Shared Skilleraa UI class tokens — keep pages visually consistent.
 */

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-black/90 active:scale-95 transition disabled:opacity-50";

export const btnPrimarySm =
  "inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-black text-white hover:bg-black/90 transition disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-full border skl-border hover:bg-neutral-50 transition disabled:opacity-50";

export const btnGhostMd =
  "inline-flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-full border skl-border hover:bg-neutral-50 transition disabled:opacity-50";

export const chipBase =
  "text-xs px-3 py-1.5 rounded-full border transition";

export function chipClass(active) {
  return `${chipBase} ${
    active ? "bg-black text-white border-black" : "skl-border hover:bg-neutral-50"
  }`;
}

export const card =
  "border skl-border rounded-2xl bg-white";

export const cardPad = `${card} p-5`;

export const cardPadLg = `${card} p-6`;

export const pageContainer = "max-w-7xl mx-auto px-5 sm:px-6 lg:px-10";

export const sectionLabel =
  "text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold";

export const inputSearch =
  "w-full border skl-border rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black bg-white";

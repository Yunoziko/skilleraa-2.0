import { motion } from "framer-motion";
import { Search, Bell, ArrowUpRight } from "lucide-react";

const jobs = [
  { title: "UI Designer", company: "Northwind Labs", budget: "₹25,000 - ₹40,000", tag: "Design" },
  { title: "React Developer", company: "Lumen Studio", budget: "₹18,000 - ₹28,000", tag: "Dev" },
  { title: "Video Editor", company: "Parallax", budget: "₹10,000 - ₹15,000", tag: "Video" },
];

export default function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {/* Background aura */}
      <div className="absolute -inset-4 bg-neutral-100 rounded-[32px] -z-10" />
      <div className="absolute -bottom-6 -right-6 h-40 w-40 border skl-border rounded-2xl bg-white -z-10 hidden md:block dotgrid" />

      <div className="bg-white border skl-border rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b skl-border">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-neutral-300" />
            <div className="h-2 w-2 rounded-full bg-neutral-300" />
            <div className="h-2 w-2 rounded-full bg-neutral-300" />
          </div>
          <div className="text-[11px] font-mono text-neutral-500">skilleraa.app / dashboard</div>
          <Bell size={14} className="text-neutral-500" />
        </div>

        {/* Search */}
        <div className="px-5 pt-5">
          <div className="flex items-center gap-2 border skl-border rounded-xl px-3 py-2.5">
            <Search size={14} className="text-neutral-400" />
            <span className="text-sm text-neutral-500">Search 2,500+ jobs…</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 px-5 mt-4 flex-wrap">
          {["Design", "Development", "Writing", "Video", "Remote"].map((f, i) => (
            <span
              key={f}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                i === 0 ? "bg-black text-white border-black" : "border-neutral-200 text-neutral-600"
              }`}
            >
              {f}
            </span>
          ))}
        </div>

        {/* Jobs list */}
        <div className="p-5 pt-4 space-y-3">
          {jobs.map((j, i) => (
            <motion.div
              key={j.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center justify-between p-3 border skl-border rounded-xl hover:bg-neutral-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-black text-white grid place-items-center font-display font-semibold text-sm">
                  {j.company[0]}
                </div>
                <div>
                  <div className="text-sm font-medium">{j.title}</div>
                  <div className="text-[11px] text-neutral-500">
                    {j.company} · {j.budget}
                  </div>
                </div>
              </div>
              <button type="button" className="p-1.5 rounded-lg border skl-border hover:bg-white">
                <ArrowUpRight size={14} />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Stat strip */}
        <div className="border-t skl-border grid grid-cols-3 divide-x divide-neutral-200 text-center">
          {[
            ["12", "Applied"],
            ["4", "Saved"],
            ["78%", "Profile"],
          ].map(([v, l]) => (
            <div key={l} className="py-3">
              <div className="font-display font-bold text-lg">{v}</div>
              <div className="text-[10px] uppercase tracking-widest text-neutral-500">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

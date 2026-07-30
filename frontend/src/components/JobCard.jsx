import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, MapPin, Clock, Wallet } from "lucide-react";
import JobStatusBadge from "@/components/JobStatusBadge";

export default function JobCard({ job, onSave, saved, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: -3 }}
      className="group relative bg-white border skl-border rounded-2xl p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all"
      data-testid={`job-card-${job.id}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-black text-white grid place-items-center font-display font-semibold shrink-0">
            {job.company_letter || job.company_name?.[0] || "S"}
          </div>
          <div className="min-w-0">
            <div className="text-xs text-neutral-500 truncate">{job.company_name}</div>
            <Link
              to={`/jobs/${job.id}`}
              className="block font-display text-[17px] leading-tight font-semibold hover:underline decoration-2 underline-offset-4 truncate"
              data-testid={`job-title-${job.id}`}
            >
              {job.title}
            </Link>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          {job.status && <JobStatusBadge status={job.status} />}
          {onSave && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onSave(job.id);
              }}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${
                saved
                  ? "bg-black text-white border-black"
                  : "border-neutral-200 text-neutral-600 hover:border-black hover:text-black"
              }`}
              aria-pressed={!!saved}
              aria-label={saved ? `Unsave ${job.title}` : `Save ${job.title}`}
              data-testid={`job-save-${job.id}`}
            >
              {saved ? "Saved" : "Save"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {(job.skills || []).slice(0, 4).map((s) => (
          <span
            key={s}
            className="text-[11px] px-2 py-0.5 rounded-full border skl-border text-neutral-700"
          >
            {s}
          </span>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-xs text-neutral-600">
        <div className="flex items-center gap-1.5">
          <Wallet size={13} className="text-neutral-400" />
          <span className="truncate">{job.budget}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={13} className="text-neutral-400" />
          <span className="truncate">{job.duration}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin size={13} className="text-neutral-400" />
          <span className="truncate">{job.remote ? "Remote" : job.location || "Onsite"}</span>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t skl-border flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 font-semibold">
          {job.experience}
        </span>
        <Link
          to={`/jobs/${job.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all"
          data-testid={`job-apply-cta-${job.id}`}
        >
          View <ArrowUpRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
}

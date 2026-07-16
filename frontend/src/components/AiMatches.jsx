import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Sparkles, ArrowUpRight, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function AiMatches() {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [triggered, setTriggered] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/ai/match-jobs");
      setMatches(data.matches || []);
      setTriggered(true);
      if ((data.matches || []).length === 0) {
        toast("No matches found. Try adding more skills to your profile.");
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || "AI matching failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border skl-border p-6" data-testid="ai-matches-panel">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-black text-white grid place-items-center">
            <Sparkles size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-lg font-semibold">AI Job Matching</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full border skl-border font-mono uppercase tracking-widest">
                Claude
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Ranked by fit with your profile — powered by Claude Sonnet.
            </p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-black text-white text-sm px-4 py-2 rounded-full hover:bg-black/90 disabled:opacity-60 active:scale-95 transition"
          data-testid="ai-run-btn"
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? "Matching…" : triggered ? "Re-run" : "Find matches"}
        </button>
      </div>

      <AnimatePresence>
        {triggered && !loading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5"
          >
            {matches.length === 0 ? (
              <div className="text-sm text-neutral-500 border-t skl-border pt-5">
                No matches yet — complete your profile with skills and a headline for better results.
              </div>
            ) : (
              <div className="space-y-3 border-t skl-border pt-5">
                {matches.map((m, i) => (
                  <motion.div
                    key={m.job.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start justify-between gap-4 p-4 rounded-xl border skl-border hover:bg-neutral-50 transition"
                    data-testid={`ai-match-${m.job.id}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-black text-white grid place-items-center font-display font-semibold shrink-0">
                        {m.job.company_letter}
                      </div>
                      <div className="min-w-0">
                        <Link to={`/jobs/${m.job.id}`} className="font-medium hover:underline truncate block">
                          {m.job.title}
                        </Link>
                        <div className="text-xs text-neutral-500">
                          {m.job.company_name} · {m.job.budget}
                        </div>
                        <p className="mt-2 text-sm text-neutral-700 italic leading-snug">
                          “{m.reason}”
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="font-display text-2xl font-medium tracking-tighter">{m.score}</div>
                      <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-semibold">Score</div>
                      <Link
                        to={`/jobs/${m.job.id}`}
                        className="text-xs inline-flex items-center gap-1 hover:gap-2 transition-all"
                      >
                        Open <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

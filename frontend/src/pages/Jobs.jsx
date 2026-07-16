import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import JobCard from "@/components/JobCard";
import EmptyState from "@/components/EmptyState";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const CATEGORIES = ["All", "Design", "Development", "Writing", "Video", "Marketing"];
const EXPERIENCE = ["All", "Beginner", "Intermediate", "Expert"];

export default function Jobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [experience, setExperience] = useState("All");
  const [remote, setRemote] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (category !== "All") params.category = category;
      if (experience !== "All") params.experience = experience;
      if (remote !== null) params.remote = remote;
      const { data } = await api.get("/jobs", { params });
      setJobs(data);
    } catch (e) {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, experience, remote]);

  useEffect(() => {
    if (user && user.role === "student") {
      api.get("/jobs/saved/ids").then((r) => setSavedIds(new Set(r.data))).catch(() => {});
    }
  }, [user]);

  const toggleSave = async (id) => {
    if (!user || user === false) {
      toast.error("Please log in to save jobs");
      return;
    }
    try {
      const { data } = await api.post(`/jobs/${id}/save`);
      const next = new Set(savedIds);
      if (data.saved) next.add(id);
      else next.delete(id);
      setSavedIds(next);
      toast.success(data.saved ? "Saved" : "Removed from saved");
    } catch (e) {
      toast.error("Please log in as a student to save");
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pt-14 pb-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold">Discover</div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl tracking-tighter font-medium">
            Browse open jobs
          </h1>
          <p className="mt-3 text-neutral-600 max-w-2xl">
            Filter by skills, budget and experience. New jobs are posted every day.
          </p>
        </motion.div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchJobs();
          }}
          className="mt-8 flex items-center gap-2 border skl-border rounded-full px-4 py-2 max-w-2xl"
          data-testid="jobs-search-form"
        >
          <Search size={16} className="text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search job titles, skills, keywords…"
            className="flex-1 bg-transparent focus:outline-none text-sm py-1"
            data-testid="jobs-search-input"
          />
          <button
            type="submit"
            className="bg-black text-white text-xs px-4 py-1.5 rounded-full hover:bg-black/90"
            data-testid="jobs-search-btn"
          >
            Search
          </button>
        </form>

        <div className="mt-6 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                category === c
                  ? "bg-black text-white border-black"
                  : "skl-border hover:bg-neutral-50"
              }`}
              data-testid={`filter-category-${c}`}
            >
              {c}
            </button>
          ))}
          <div className="w-px h-6 bg-neutral-200 mx-1 self-center" />
          {EXPERIENCE.map((e) => (
            <button
              key={e}
              onClick={() => setExperience(e)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                experience === e
                  ? "bg-black text-white border-black"
                  : "skl-border hover:bg-neutral-50"
              }`}
              data-testid={`filter-experience-${e}`}
            >
              {e}
            </button>
          ))}
          <div className="w-px h-6 bg-neutral-200 mx-1 self-center" />
          <button
            onClick={() => setRemote(remote === true ? null : true)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              remote === true ? "bg-black text-white border-black" : "skl-border hover:bg-neutral-50"
            }`}
            data-testid="filter-remote"
          >
            Remote
          </button>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl border skl-border bg-neutral-50 animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No jobs match your filters"
            description="Try clearing filters or broadening your search."
            icon={Search}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((j, i) => (
              <JobCard
                key={j.id}
                job={j}
                index={i}
                onSave={user?.role === "student" ? toggleSave : undefined}
                saved={savedIds.has(j.id)}
              />
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

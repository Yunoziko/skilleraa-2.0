import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import JobCard from "@/components/JobCard";
import EmptyState from "@/components/EmptyState";
import DemoBanner from "@/components/DemoBanner";
import { JobCardSkeletonGrid } from "@/components/Skeleton";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { filterMockJobs } from "@/data/mockJobs";
import {
  listMockSavedIds,
  subscribeSavedJobs,
  toggleMockSave,
} from "@/lib/mockSavedJobs";
import { chipClass, pageContainer } from "@/lib/uiClasses";

const CATEGORIES = ["All", "Design", "Development", "Writing", "Video", "Marketing"];
const EXPERIENCE = ["All", "Beginner", "Intermediate", "Expert"];

export default function Jobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [experience, setExperience] = useState("All");
  const [remote, setRemote] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());

  const clearFilters = () => {
    setQ("");
    setCategory("All");
    setExperience("All");
    setRemote(null);
  };

  const refreshSaved = () => {
    const local = listMockSavedIds();
    if (user && user.role === "student" && !usingMock) {
      api
        .get("/jobs/saved/ids")
        .then((r) => setSavedIds(new Set([...(r.data || []), ...local])))
        .catch(() => setSavedIds(new Set(local)));
    } else {
      setSavedIds(new Set(local));
    }
  };

  const fetchJobs = async (overrides = {}) => {
    setLoading(true);
    setLoadError(false);
    const nextQ = overrides.q !== undefined ? overrides.q : q;
    const nextCategory = overrides.category !== undefined ? overrides.category : category;
    const nextExperience = overrides.experience !== undefined ? overrides.experience : experience;
    const nextRemote = overrides.remote !== undefined ? overrides.remote : remote;
    const params = {};
    if (nextQ) params.q = nextQ;
    if (nextCategory !== "All") params.category = nextCategory;
    if (nextExperience !== "All") params.experience = nextExperience;
    if (nextRemote !== null) params.remote = nextRemote;

    try {
      const { data } = await api.get("/jobs", { params });
      setJobs(Array.isArray(data) ? data : []);
      setUsingMock(false);
    } catch {
      setJobs(filterMockJobs(params));
      setUsingMock(true);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, experience, remote]);

  useEffect(() => {
    refreshSaved();
    return subscribeSavedJobs(refreshSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, usingMock]);

  const onClearFilters = () => {
    clearFilters();
    fetchJobs({ q: "", category: "All", experience: "All", remote: null });
  };

  const toggleSave = async (id) => {
    try {
      if (!usingMock && user && user.role === "student") {
        try {
          const { data } = await api.post(`/jobs/${id}/save`);
          const next = new Set(savedIds);
          if (data.saved) next.add(id);
          else next.delete(id);
          setSavedIds(next);
          toast.success(data.saved ? "Job saved" : "Removed from saved");
          return;
        } catch {
          // fall through to mock
        }
      }
      const { saved } = toggleMockSave(id);
      setSavedIds(new Set(listMockSavedIds()));
      toast.success(saved ? "Job saved" : "Removed from saved");
    } catch {
      toast.error("Could not update saved jobs. Try again.");
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />

      <section className={`${pageContainer} pt-14 pb-8`}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold">Discover</div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl tracking-tighter font-medium">
            Browse open jobs
          </h1>
          <p className="mt-3 text-neutral-600 max-w-2xl">
            Filter by skills, budget and experience. New jobs are posted every day.
          </p>
        </motion.div>

        {usingMock && loadError && (
          <div className="mt-6">
            <DemoBanner message="Showing demo jobs — live API unavailable." />
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchJobs();
          }}
          className="mt-8 flex items-center gap-2 border skl-border rounded-full px-4 py-2 max-w-2xl"
          data-testid="jobs-search-form"
          role="search"
        >
          <Search size={16} className="text-neutral-400" aria-hidden />
          <label htmlFor="jobs-search-input" className="sr-only">
            Search jobs
          </label>
          <input
            id="jobs-search-input"
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

        <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Job filters">
          <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-semibold mr-1">Category</span>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={chipClass(category === c)}
              aria-pressed={category === c}
              data-testid={`filter-category-${c}`}
            >
              {c}
            </button>
          ))}
          <div className="w-px h-6 bg-neutral-200 mx-2 self-center hidden sm:block" aria-hidden />
          <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-semibold mr-1 w-full sm:w-auto mt-2 sm:mt-0">
            Level
          </span>
          {EXPERIENCE.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setExperience(e)}
              className={chipClass(experience === e)}
              aria-pressed={experience === e}
              data-testid={`filter-experience-${e}`}
            >
              {e}
            </button>
          ))}
          <div className="w-px h-6 bg-neutral-200 mx-2 self-center hidden sm:block" aria-hidden />
          <button
            type="button"
            onClick={() => setRemote(remote === true ? null : true)}
            className={chipClass(remote === true)}
            aria-pressed={remote === true}
            data-testid="filter-remote"
          >
            Remote only
          </button>
        </div>
      </section>

      <section className={`${pageContainer} pb-24`}>
        {loading ? (
          <JobCardSkeletonGrid count={6} />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No jobs match your filters"
            description="Try clearing filters or broadening your search."
            icon={Search}
            ctaLabel="Clear filters"
            onCtaClick={onClearFilters}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((j, i) => (
              <JobCard
                key={j.id}
                job={j}
                index={i}
                onSave={toggleSave}
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

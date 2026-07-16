import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Wallet, CheckCircle2, Building2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function JobDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showApply, setShowApply] = useState(false);

  useEffect(() => {
    api.get(`/jobs/${id}`).then((r) => setJob(r.data)).catch(() => {
      toast.error("Job not found");
      nav("/jobs");
    });
  }, [id, nav]);

  useEffect(() => {
    if (user?.role === "student") {
      api.get("/applications/mine").then((r) => {
        if (r.data.some((a) => a.job_id === id)) setApplied(true);
      }).catch(() => {});
    }
  }, [user, id]);

  const submitApplication = async (e) => {
    e.preventDefault();
    if (!user || user === false) {
      nav("/login", { state: { from: `/jobs/${id}` } });
      return;
    }
    if (user.role !== "student") {
      toast.error("Only students can apply to jobs");
      return;
    }
    setApplying(true);
    try {
      await api.post(`/jobs/${id}/apply`, { cover_letter: coverLetter });
      setApplied(true);
      setShowApply(false);
      toast.success("Application submitted");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  if (!job) {
    return (
      <div className="min-h-screen bg-white grid place-items-center">
        <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />
      <section className="max-w-5xl mx-auto px-6 lg:px-10 pt-14 pb-24">
        <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-black" data-testid="job-back-link">
          <ArrowLeft size={14} /> All jobs
        </Link>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-black text-white grid place-items-center font-display font-semibold text-lg">
                  {job.company_letter}
                </div>
                <div>
                  <div className="text-sm text-neutral-500">{job.company_name}</div>
                  <h1 className="font-display text-3xl md:text-4xl tracking-tighter font-medium" data-testid="job-detail-title">
                    {job.title}
                  </h1>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-1.5">
                {(job.skills || []).map((s) => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full border skl-border">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t skl-border pt-8">
              <h2 className="font-display text-xl font-semibold">Description</h2>
              <p className="mt-3 text-neutral-700 leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </div>

            <div className="border-t skl-border pt-8">
              <h2 className="font-display text-xl font-semibold">Required skills</h2>
              <ul className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {(job.skills || []).map((s) => (
                  <li key={s} className="flex items-center gap-2 text-neutral-700">
                    <CheckCircle2 size={14} /> {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="border skl-border rounded-2xl p-6 sticky top-24">
              <div className="space-y-4 text-sm">
                <Row icon={Wallet} label="Budget" value={job.budget} />
                <Row icon={Clock} label="Duration" value={job.duration} />
                <Row icon={MapPin} label="Location" value={job.remote ? "Remote" : job.location || "Onsite"} />
                <Row icon={Building2} label="Experience" value={job.experience} />
              </div>

              <div className="mt-6 border-t skl-border pt-6">
                <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">About client</div>
                <Link
                  to={`/u/${job.client_id}`}
                  className="mt-3 flex items-center gap-3 hover:bg-neutral-50 p-2 -mx-2 rounded-lg transition"
                  data-testid="job-client-link"
                >
                  <div className="h-10 w-10 rounded-full bg-black text-white grid place-items-center font-display font-semibold">
                    {job.company_letter}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{job.company_name}</div>
                    <div className="text-xs text-neutral-500">{job.applications_count || 0} applicants</div>
                  </div>
                </Link>
              </div>

              {applied ? (
                <div className="mt-6 border skl-border rounded-xl p-4 text-center text-sm bg-neutral-50" data-testid="job-applied-status">
                  <CheckCircle2 size={18} className="mx-auto mb-1" />
                  You've applied
                </div>
              ) : user?.role === "client" ? (
                <div className="mt-6 text-xs text-neutral-500 text-center">Clients cannot apply to jobs.</div>
              ) : (
                <button
                  onClick={() => {
                    if (!user || user === false) {
                      nav("/login", { state: { from: `/jobs/${id}` } });
                    } else {
                      setShowApply(!showApply);
                    }
                  }}
                  className="mt-6 w-full bg-black text-white rounded-full py-3 text-sm font-medium hover:bg-black/90 active:scale-[0.98] transition"
                  data-testid="job-apply-btn"
                >
                  Apply now
                </button>
              )}

              {showApply && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  onSubmit={submitApplication}
                  className="mt-4"
                >
                  <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
                    Cover letter
                  </label>
                  <textarea
                    required
                    minLength={20}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    rows={5}
                    placeholder="Tell the client why you're a great fit…"
                    className="mt-2 w-full border skl-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black transition"
                    data-testid="apply-cover-letter"
                  />
                  <button
                    type="submit"
                    disabled={applying}
                    className="mt-3 w-full bg-black text-white rounded-full py-2.5 text-sm hover:bg-black/90 disabled:opacity-60"
                    data-testid="apply-submit-btn"
                  >
                    {applying ? "Submitting…" : "Submit application"}
                  </button>
                </motion.form>
              )}
            </div>
          </aside>
        </motion.div>
      </section>
      <Footer />
    </div>
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-neutral-600">
        <Icon size={14} className="text-neutral-400" />
        <span className="text-xs uppercase tracking-widest">{label}</span>
      </div>
      <div className="font-medium text-right">{value}</div>
    </div>
  );
}

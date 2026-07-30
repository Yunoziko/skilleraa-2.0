import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Clock, Wallet, CheckCircle2, Building2, Bookmark } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ConfirmModal from "@/components/ConfirmModal";
import JobStatusBadge from "@/components/JobStatusBadge";
import api from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { getMockJobById } from "@/data/mockJobs";
import { isPubliclyListed } from "@/lib/jobStatus";
import {
  createMockApplication,
  hasMockApplied,
  resolveApplicantStudent,
  subscribeApplications,
} from "@/lib/mockApplications";
import {
  isMockSaved,
  listMockSavedIds,
  subscribeSavedJobs,
  toggleMockSave,
} from "@/lib/mockSavedJobs";

export default function JobDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [expectedBudget, setExpectedBudget] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [saved, setSaved] = useState(false);

  const student = resolveApplicantStudent(user);

  useEffect(() => {
    let active = true;
    api
      .get(`/jobs/${id}`)
      .then((r) => {
        if (!active) return;
        setJob(r.data);
        setUsingMock(false);
      })
      .catch(() => {
        if (!active) return;
        const mock = getMockJobById(id);
        if (mock) {
          setJob(mock);
          setUsingMock(true);
          return;
        }
        toast.error("Job not found");
        nav("/jobs");
      });
    return () => {
      active = false;
    };
  }, [id, nav]);

  useEffect(() => {
    const refreshApplied = () => {
      if (hasMockApplied(id, student.id)) {
        setApplied(true);
        return;
      }
      if (user?.role === "student" && !usingMock) {
        api
          .get("/applications/mine")
          .then((r) => {
            if (r.data.some((a) => String(a.job_id) === String(id))) setApplied(true);
          })
          .catch(() => {});
      }
    };
    refreshApplied();
    return subscribeApplications(refreshApplied);
  }, [user, id, usingMock, student.id]);

  useEffect(() => {
    const refreshSaved = () => setSaved(isMockSaved(id) || listMockSavedIds().includes(String(id)));
    refreshSaved();
    return subscribeSavedJobs(refreshSaved);
  }, [id]);

  const validateForm = () => {
    if (hasMockApplied(id, student.id) || applied) {
      return "You have already applied to this job.";
    }
    if (!coverLetter.trim() || coverLetter.trim().length < 20) {
      return "Cover letter must be at least 20 characters.";
    }
    if (!expectedBudget.trim()) {
      return "Expected budget is required.";
    }
    if (!deliveryTime.trim()) {
      return "Estimated delivery time is required.";
    }
    if (portfolioUrl.trim()) {
      try {
        const raw = portfolioUrl.trim();
        const url = raw.startsWith("http") ? raw : `https://${raw}`;
        // eslint-disable-next-line no-new
        new URL(url);
      } catch {
        return "Portfolio link must be a valid URL.";
      }
    }
    if (job && !isPubliclyListed(job.status)) {
      return "This job is not open for new applications.";
    }
    return "";
  };

  const saveLocalApplication = () => {
    createMockApplication({
      job,
      jobId: id,
      coverLetter,
      expectedBudget,
      deliveryTime,
      portfolioUrl,
      student,
    });
    setApplied(true);
    setShowApply(false);
    setConfirmOpen(false);
    setCoverLetter("");
    setExpectedBudget("");
    setDeliveryTime("");
    setPortfolioUrl("");
    toast.success("Application submitted successfully");
  };

  const performSubmit = async () => {
    setApplying(true);
    try {
      if (!usingMock && user && user !== false && user.role === "student") {
        try {
          await api.post(`/jobs/${id}/apply`, { cover_letter: coverLetter.trim() });
          try {
            if (!hasMockApplied(id, student.id)) {
              createMockApplication({
                job,
                jobId: id,
                coverLetter,
                expectedBudget,
                deliveryTime,
                portfolioUrl,
                student,
              });
            }
          } catch {
            // duplicate local copy
          }
          setApplied(true);
          setShowApply(false);
          setConfirmOpen(false);
          toast.success("Application submitted successfully");
          return;
        } catch (e) {
          const detail = e.response?.data?.detail;
          if (typeof detail === "string" && /already applied/i.test(detail)) {
            setApplied(true);
            setConfirmOpen(false);
            setFormError("You have already applied to this job.");
            return;
          }
          // Backend unavailable — fall through to mock
        }
      }

      saveLocalApplication();
    } catch (e) {
      const msg = e?.message || e.response?.data?.detail || "Failed to apply";
      setFormError(typeof msg === "string" ? msg : "Failed to apply");
      setConfirmOpen(false);
    } finally {
      setApplying(false);
    }
  };

  const onFormSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    if (user && user !== false && user.role === "client") {
      toast.error("Only students can apply to jobs");
      return;
    }
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    setConfirmOpen(true);
  };

  const toggleSave = async () => {
    try {
      if (!usingMock && user && user.role === "student") {
        try {
          const { data } = await api.post(`/jobs/${id}/save`);
          setSaved(Boolean(data.saved));
          toast.success(data.saved ? "Job saved" : "Removed from saved");
          return;
        } catch {
          // mock fallback
        }
      }
      const { saved: next } = toggleMockSave(id);
      setSaved(next);
      toast.success(next ? "Job saved" : "Removed from saved");
    } catch {
      toast.error("Could not update saved jobs. Try again.");
    }
  };

  if (!job) {
    return (
      <div className="min-h-screen bg-white grid place-items-center">
        <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canApply = isPubliclyListed(job.status);

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
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm text-neutral-500">{job.company_name}</div>
                    <JobStatusBadge status={job.status} />
                  </div>
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

              <button
                type="button"
                onClick={toggleSave}
                className={`mt-4 w-full inline-flex items-center justify-center gap-2 text-sm rounded-full py-2.5 border transition ${
                  saved ? "bg-black text-white border-black" : "skl-border hover:bg-neutral-50"
                }`}
                data-testid="job-detail-save"
              >
                <Bookmark size={14} />
                {saved ? "Saved" : "Save job"}
              </button>

              {applied ? (
                <div className="mt-4 border skl-border rounded-xl p-4 text-center text-sm bg-neutral-50" data-testid="job-applied-status">
                  <CheckCircle2 size={18} className="mx-auto mb-1" />
                  You've already applied
                </div>
              ) : user?.role === "client" ? (
                <div className="mt-4 text-xs text-neutral-500 text-center">Clients cannot apply to jobs.</div>
              ) : !canApply ? (
                <div className="mt-4 text-xs text-neutral-500 text-center border skl-border rounded-xl p-4 bg-neutral-50">
                  This job is not open for applications.
                </div>
              ) : (
                <button type="button"
                  onClick={() => setShowApply(!showApply)}
                  className="mt-4 w-full bg-black text-white rounded-full py-3 text-sm font-medium hover:bg-black/90 active:scale-[0.98] transition"
                  data-testid="job-apply-btn"
                >
                  Apply now
                </button>
              )}

              {showApply && !applied && canApply && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  onSubmit={onFormSubmit}
                  className="mt-4 space-y-3"
                  data-testid="apply-form"
                >
                  <div>
                    <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
                      Cover letter
                    </label>
                    <textarea
                      required
                      minLength={20}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      rows={4}
                      placeholder="Tell the client why you're a great fit…"
                      className="mt-2 w-full border skl-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black transition"
                      data-testid="apply-cover-letter"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
                      Expected budget
                    </label>
                    <input
                      required
                      type="text"
                      value={expectedBudget}
                      onChange={(e) => setExpectedBudget(e.target.value)}
                      placeholder="e.g. ₹10,000"
                      className="mt-2 w-full border skl-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black transition"
                      data-testid="apply-expected-budget"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
                      Estimated delivery time
                    </label>
                    <input
                      required
                      type="text"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      placeholder="e.g. 2 weeks"
                      className="mt-2 w-full border skl-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black transition"
                      data-testid="apply-delivery-time"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
                      Portfolio link <span className="normal-case tracking-normal text-neutral-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={portfolioUrl}
                      onChange={(e) => setPortfolioUrl(e.target.value)}
                      placeholder="https://…"
                      className="mt-2 w-full border skl-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-black transition"
                      data-testid="apply-portfolio-url"
                    />
                  </div>

                  {formError && (
                    <div className="text-sm text-black bg-neutral-100 border skl-border rounded-lg px-3 py-2" data-testid="apply-form-error">
                      {formError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={applying}
                    className="w-full bg-black text-white rounded-full py-2.5 text-sm hover:bg-black/90 disabled:opacity-60"
                    data-testid="apply-submit-btn"
                  >
                    Review & submit
                  </button>
                </motion.form>
              )}
            </div>
          </aside>
        </motion.div>
      </section>
      <Footer />

      <ConfirmModal
        open={confirmOpen}
        title="Submit application?"
        description={`You're applying to “${job.title}”. You can only apply once per job.`}
        confirmLabel="Confirm apply"
        cancelLabel="Go back"
        loading={applying}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={performSubmit}
      />
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

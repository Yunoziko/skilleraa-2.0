import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import api from "@/lib/api";
import { toast } from "sonner";

const CATEGORIES = ["Design", "Development", "Writing", "Video", "Marketing", "Other"];
const EXPERIENCE = ["Beginner", "Intermediate", "Expert"];

export default function PostJob() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    title: "",
    category: "Design",
    description: "",
    skills: "",
    budget: "",
    duration: "",
    experience: "Beginner",
    remote: true,
    location: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post("/jobs", {
        ...form,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Job posted");
      nav(`/jobs/${data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to post job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell title="Post a Job">
      <form onSubmit={submit} className="max-w-3xl space-y-5" data-testid="post-job-form">
        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Job Title</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
            placeholder="e.g. React Developer for Landing Page"
            data-testid="post-job-title"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black bg-white"
              data-testid="post-job-category"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Experience Level</label>
            <select
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
              className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black bg-white"
              data-testid="post-job-experience"
            >
              {EXPERIENCE.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Description</label>
          <textarea
            required
            rows={6}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
            placeholder="Describe the job, deliverables, and expectations…"
            data-testid="post-job-description"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Required Skills (comma separated)</label>
          <input
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
            placeholder="React, Tailwind, Framer Motion"
            className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
            data-testid="post-job-skills"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Budget</label>
            <input
              required
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
              placeholder="₹18,000 - ₹28,000"
              data-testid="post-job-budget"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Duration</label>
            <input
              required
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
              placeholder="1-2 weeks"
              data-testid="post-job-duration"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.remote}
              onChange={(e) => setForm({ ...form, remote: e.target.checked })}
              className="h-4 w-4 rounded border-neutral-300 text-black focus:ring-black"
              data-testid="post-job-remote"
            />
            Remote
          </label>
          {!form.remote && (
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Location"
              className="flex-1 border skl-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-black"
              data-testid="post-job-location"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white rounded-full px-6 py-3 text-sm hover:bg-black/90 disabled:opacity-60"
          data-testid="post-job-submit"
        >
          {saving ? "Posting…" : "Post Job"}
        </button>
      </form>
    </DashboardShell>
  );
}

import { useState, useEffect } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";

export default function StudentProfile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    name: "",
    headline: "",
    bio: "",
    location: "",
    skills: "",
    education: "",
    portfolio_url: "",
    resume_url: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        headline: user.headline || "",
        bio: user.bio || "",
        location: user.location || "",
        skills: (user.skills || []).join(", "),
        education: user.education || "",
        portfolio_url: user.portfolio_url || "",
        resume_url: user.resume_url || "",
      });
    }
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/profile", {
        ...form,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      });
      await refresh();
      toast.success("Profile updated");
    } catch (e) {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell title="Your Profile">
      <form onSubmit={save} className="grid lg:grid-cols-3 gap-6" data-testid="profile-form">
        <div className="lg:col-span-1 border skl-border rounded-2xl p-6 h-fit">
          <div className="h-20 w-20 rounded-2xl bg-black text-white grid place-items-center font-display font-semibold text-3xl">
            {user?.avatar_letter}
          </div>
          <div className="mt-4">
            <div className="font-display text-xl font-semibold">{user?.name}</div>
            <div className="text-sm text-neutral-500">{user?.email}</div>
          </div>
          <div className="mt-4 text-xs uppercase tracking-widest text-neutral-500 font-semibold">Role</div>
          <div className="text-sm mt-1 capitalize">{user?.role}</div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <Field label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="profile-name" />
          <Field label="Headline" value={form.headline} onChange={(v) => setForm({ ...form, headline: v })} placeholder="e.g. Frontend Developer & UI Designer" testid="profile-headline" />
          <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} placeholder="City, Country" testid="profile-location" />
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Short Bio</label>
            <textarea
              rows={4}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
              placeholder="Tell clients about yourself…"
              data-testid="profile-bio"
            />
          </div>
          <Field label="Skills (comma separated)" value={form.skills} onChange={(v) => setForm({ ...form, skills: v })} placeholder="React, Figma, Tailwind" testid="profile-skills" />
          <Field label="Education" value={form.education} onChange={(v) => setForm({ ...form, education: v })} placeholder="B.Tech, IIT Roorkee" testid="profile-education" />
          <Field label="Portfolio URL" value={form.portfolio_url} onChange={(v) => setForm({ ...form, portfolio_url: v })} placeholder="https://…" testid="profile-portfolio" />
          <Field label="Resume URL" value={form.resume_url} onChange={(v) => setForm({ ...form, resume_url: v })} placeholder="https://…" testid="profile-resume" />

          <button
            type="submit"
            disabled={saving}
            className="bg-black text-white rounded-full px-6 py-2.5 text-sm hover:bg-black/90 disabled:opacity-60"
            data-testid="profile-save-btn"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}

function Field({ label, value, onChange, placeholder, testid }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
        data-testid={testid}
      />
    </div>
  );
}

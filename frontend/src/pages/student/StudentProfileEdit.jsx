import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  DEMO_STUDENT_PROFILE_ID,
  getMyMockProfile,
  saveMockProfile,
} from "@/lib/mockProfiles";

const AVAILABILITY = [
  { value: "available", label: "Available" },
  { value: "limited", label: "Limited" },
  { value: "unavailable", label: "Unavailable" },
];

export default function StudentProfileEdit() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    headline: "",
    bio: "",
    location: "",
    skills: "",
    education: "",
    experience: "",
    portfolio_links: "",
    resume_filename: "",
    availability: "available",
  });

  useEffect(() => {
    const local = getMyMockProfile("student");
    const src = user && user !== false ? { ...local, ...user } : local;
    setForm({
      name: src.name || "",
      headline: src.headline || "",
      bio: src.bio || "",
      location: src.location || "",
      skills: Array.isArray(src.skills) ? src.skills.join(", ") : src.skills || "",
      education: src.education || "",
      experience: src.experience || local.experience || "",
      portfolio_links: (src.portfolio_links || (src.portfolio_url ? [src.portfolio_url] : [])).join("\n"),
      resume_filename: src.resume_filename || local.resume_filename || "",
      availability: src.availability || "available",
    });
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const skills = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
    const portfolio_links = form.portfolio_links
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      name: form.name.trim(),
      headline: form.headline.trim(),
      bio: form.bio.trim(),
      location: form.location.trim(),
      skills,
      education: form.education.trim(),
      experience: form.experience.trim(),
      portfolio_url: portfolio_links[0] || "",
      portfolio_links,
      resume_filename: form.resume_filename.trim(),
      availability: form.availability,
      role: "student",
      id: (user && user !== false && user.id) || DEMO_STUDENT_PROFILE_ID,
      email: (user && user !== false && user.email) || getMyMockProfile("student").email,
    };

    try {
      if (user && user !== false) {
        try {
          await api.put("/profile", {
            name: payload.name,
            headline: payload.headline,
            bio: payload.bio,
            location: payload.location,
            skills: payload.skills,
            education: payload.education,
            portfolio_url: payload.portfolio_url,
          });
          if (typeof refresh === "function") await refresh();
        } catch {
          // fall through to local
        }
      }
      saveMockProfile(payload);
      toast.success("Profile updated");
      nav("/student/profile");
    } catch {
      toast.error("Could not save profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell
      title="Edit Profile"
      actions={
        <Link to="/student/profile" className="text-sm text-neutral-600 hover:text-black underline underline-offset-4">
          Cancel
        </Link>
      }
    >
      <form onSubmit={save} className="grid lg:grid-cols-3 gap-6 max-w-5xl" data-testid="student-profile-edit-form">
        <div className="lg:col-span-1 border skl-border rounded-2xl p-6 h-fit">
          <div className="h-20 w-20 rounded-2xl bg-black text-white grid place-items-center font-display font-semibold text-3xl">
            {(form.name || "S")[0].toUpperCase()}
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-widest text-neutral-400">Photo placeholder</div>
          <p className="mt-4 text-sm text-neutral-600">
            Update your public student profile. Changes save locally while the backend is unavailable.
          </p>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <Field label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required testid="profile-name" />
          <Field label="Headline" value={form.headline} onChange={(v) => setForm({ ...form, headline: v })} placeholder="e.g. Frontend Developer & UI Designer" testid="profile-headline" />
          <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} placeholder="City, Country" testid="profile-location" />

          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Availability</label>
            <select
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
              className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black bg-white"
              data-testid="profile-availability"
            >
              {AVAILABILITY.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">About</label>
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

          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Experience</label>
            <textarea
              rows={5}
              value={form.experience}
              onChange={(e) => setForm({ ...form, experience: e.target.value })}
              className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
              placeholder="Roles, projects, internships…"
              data-testid="profile-experience"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Portfolio links</label>
            <textarea
              rows={3}
              value={form.portfolio_links}
              onChange={(e) => setForm({ ...form, portfolio_links: e.target.value })}
              className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
              placeholder={"One URL per line\nhttps://…"}
              data-testid="profile-portfolio-links"
            />
          </div>

          <Field
            label="Resume filename (placeholder)"
            value={form.resume_filename}
            onChange={(v) => setForm({ ...form, resume_filename: v })}
            placeholder="Your_Name_Resume.pdf"
            testid="profile-resume-name"
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white rounded-full px-6 py-2.5 text-sm hover:bg-black/90 disabled:opacity-60"
              data-testid="profile-save-btn"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <Link to="/student/profile" className="text-sm text-neutral-600 hover:text-black">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </DashboardShell>
  );
}

function Field({ label, value, onChange, placeholder, testid, required }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">{label}</label>
      <input
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
        data-testid={testid}
      />
    </div>
  );
}

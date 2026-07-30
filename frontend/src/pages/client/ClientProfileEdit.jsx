import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  DEMO_CLIENT_PROFILE_ID,
  getMyMockProfile,
  saveMockProfile,
} from "@/lib/mockProfiles";

const SIZES = ["1–10", "11–50", "51–200", "201–500", "500+"];

export default function ClientProfileEdit() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    company_website: "",
    company_description: "",
    location: "",
    industry: "",
    company_size: "11–50",
  });

  useEffect(() => {
    const local = getMyMockProfile("client");
    const src = user && user !== false ? { ...local, ...user } : local;
    setForm({
      name: src.name || "",
      company_name: src.company_name || "",
      company_website: src.company_website || "",
      company_description: src.company_description || "",
      location: src.location || "",
      industry: src.industry || local.industry || "",
      company_size: src.company_size || local.company_size || "11–50",
    });
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      name: form.name.trim(),
      company_name: form.company_name.trim(),
      company_website: form.company_website.trim(),
      company_description: form.company_description.trim(),
      location: form.location.trim(),
      industry: form.industry.trim(),
      company_size: form.company_size,
      role: "client",
      id: (user && user !== false && user.id) || DEMO_CLIENT_PROFILE_ID,
      email: (user && user !== false && user.email) || getMyMockProfile("client").email,
    };

    try {
      if (user && user !== false) {
        try {
          await api.put("/profile", {
            name: payload.name,
            company_name: payload.company_name,
            company_website: payload.company_website,
            company_description: payload.company_description,
            location: payload.location,
          });
          if (typeof refresh === "function") await refresh();
        } catch {
          // local fallback
        }
      }
      saveMockProfile(payload);
      toast.success("Company profile updated");
      nav("/client/profile");
    } catch {
      toast.error("Could not save profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell
      title="Edit Company Profile"
      actions={
        <Link to="/client/profile" className="text-sm text-neutral-600 hover:text-black underline underline-offset-4">
          Cancel
        </Link>
      }
    >
      <form onSubmit={save} className="grid lg:grid-cols-3 gap-6 max-w-4xl" data-testid="client-profile-edit-form">
        <div className="lg:col-span-1 border skl-border rounded-2xl p-6 h-fit">
          <div className="h-20 w-20 rounded-2xl bg-black text-white grid place-items-center font-display font-semibold text-3xl">
            {(form.company_name || form.name || "C")[0].toUpperCase()}
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-widest text-neutral-400">Logo placeholder</div>
          <p className="mt-4 text-sm text-neutral-600">
            Update how your company appears to students. Saves locally if the API is down.
          </p>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <Field label="Contact Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="cp-name" />
          <Field label="Company Name" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} required testid="cp-company" />
          <Field label="Website" value={form.company_website} onChange={(v) => setForm({ ...form, company_website: v })} placeholder="https://…" testid="cp-website" />
          <Field label="Industry" value={form.industry} onChange={(v) => setForm({ ...form, industry: v })} placeholder="e.g. SaaS / EdTech" testid="cp-industry" />
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Company size</label>
            <select
              value={form.company_size}
              onChange={(e) => setForm({ ...form, company_size: e.target.value })}
              className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black bg-white"
              data-testid="cp-size"
            >
              {SIZES.map((s) => (
                <option key={s} value={s}>{s} employees</option>
              ))}
            </select>
          </div>
          <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} testid="cp-location" />
          <div>
            <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">About the company</label>
            <textarea
              rows={5}
              value={form.company_description}
              onChange={(e) => setForm({ ...form, company_description: e.target.value })}
              className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
              placeholder="What does your company do?"
              data-testid="cp-description"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-black text-white rounded-full px-6 py-2.5 text-sm hover:bg-black/90 disabled:opacity-60"
              data-testid="cp-save-btn"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <Link to="/client/profile" className="text-sm text-neutral-600 hover:text-black">
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

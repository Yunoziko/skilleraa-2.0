import { useState, useEffect } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { toast } from "sonner";

export default function ClientProfile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({
    name: "",
    company_name: "",
    company_website: "",
    company_description: "",
    location: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        company_name: user.company_name || "",
        company_website: user.company_website || "",
        company_description: user.company_description || "",
        location: user.location || "",
      });
    }
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/profile", form);
      await refresh();
      toast.success("Company profile updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell title="Company Profile">
      <form onSubmit={save} className="grid lg:grid-cols-3 gap-6 max-w-4xl" data-testid="client-profile-form">
        <div className="lg:col-span-1 border skl-border rounded-2xl p-6 h-fit">
          <div className="h-20 w-20 rounded-2xl bg-black text-white grid place-items-center font-display font-semibold text-3xl">
            {(form.company_name || user?.name || "S")[0].toUpperCase()}
          </div>
          <div className="mt-4">
            <div className="font-display text-xl font-semibold">{form.company_name || user?.name}</div>
            <div className="text-sm text-neutral-500">{user?.email}</div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-5">
          <Field label="Contact Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="cp-name" />
          <Field label="Company Name" value={form.company_name} onChange={(v) => setForm({ ...form, company_name: v })} testid="cp-company" />
          <Field label="Website" value={form.company_website} onChange={(v) => setForm({ ...form, company_website: v })} placeholder="https://…" testid="cp-website" />
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
          <button
            type="submit"
            disabled={saving}
            className="bg-black text-white rounded-full px-6 py-2.5 text-sm hover:bg-black/90 disabled:opacity-60"
            data-testid="cp-save-btn"
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

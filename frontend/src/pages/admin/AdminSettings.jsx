import { useEffect, useState } from "react";
import { toast } from "sonner";
import AdminShell from "@/components/layout/AdminShell";
import { ListRowSkeleton } from "@/components/Skeleton";
import {
  getAdminSettings,
  subscribeAdmin,
  updateAdminSetting,
} from "@/lib/mockAdmin";

const TOGGLES = [
  {
    key: "new_signups_enabled",
    label: "New signups",
    description: "Allow students and clients to create accounts.",
  },
  {
    key: "job_posting_enabled",
    label: "Job posting",
    description: "Clients can publish new jobs.",
  },
  {
    key: "applications_enabled",
    label: "Applications",
    description: "Students can apply to open jobs.",
  },
  {
    key: "messaging_enabled",
    label: "Messaging",
    description: "In-app conversations between parties.",
  },
  {
    key: "reviews_enabled",
    label: "Reviews & ratings",
    description: "Allow leaving reviews after completed work.",
  },
  {
    key: "featured_jobs_enabled",
    label: "Featured jobs",
    description: "Highlight selected listings on browse.",
  },
  {
    key: "require_email_verify",
    label: "Require email verify",
    description: "Mock gate — enforce verification before posting.",
  },
  {
    key: "maintenance_mode",
    label: "Maintenance mode",
    description: "Show a platform downtime banner (mock).",
  },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const load = () => setSettings(getAdminSettings());
    load();
    return subscribeAdmin(load);
  }, []);

  const toggle = (key) => {
    try {
      const next = updateAdminSetting(key, !settings[key]);
      setSettings(next);
      toast.success("Setting updated (mock)");
    } catch (e) {
      toast.error(e.message || "Could not update");
    }
  };

  return (
    <AdminShell title="Platform settings">
      <p className="text-sm text-neutral-600 mb-6 max-w-xl">
        Mock toggles stored in localStorage. They do not affect auth or the backend while Supabase is paused.
      </p>

      {!settings ? (
        <ListRowSkeleton count={4} />
      ) : (
        <div className="space-y-3 max-w-2xl" data-testid="admin-settings">
          {TOGGLES.map((t) => (
            <div
              key={t.key}
              className="border skl-border rounded-2xl p-5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{t.description}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!settings[t.key]}
                onClick={() => toggle(t.key)}
                className={`relative h-7 w-12 rounded-full transition shrink-0 ${
                  settings[t.key] ? "bg-black" : "bg-neutral-200"
                }`}
                data-testid={`setting-${t.key}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition ${
                    settings[t.key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

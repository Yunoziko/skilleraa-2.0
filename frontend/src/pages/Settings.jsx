import DashboardShell from "@/components/layout/DashboardShell";
import { useAuth } from "@/context/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  return (
    <DashboardShell title="Settings">
      <div className="border skl-border rounded-2xl p-6 max-w-lg">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Account</div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between border-b skl-border py-2">
            <span className="text-neutral-500">Email</span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex justify-between border-b skl-border py-2">
            <span className="text-neutral-500">Role</span>
            <span className="font-medium capitalize">{user?.role}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-neutral-500">Joined</span>
            <span className="font-medium">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}</span>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

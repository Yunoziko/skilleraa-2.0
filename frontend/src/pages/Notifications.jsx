import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import { Bell } from "lucide-react";

export default function Notifications() {
  return (
    <DashboardShell title="Notifications">
      <EmptyState
        title="You're all caught up"
        description="Notifications for job matches, application updates, and messages will appear here."
        icon={Bell}
      />
    </DashboardShell>
  );
}

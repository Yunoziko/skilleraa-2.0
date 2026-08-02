import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminShell from "@/components/layout/AdminShell";
import ErrorState from "@/components/ErrorState";
import { StatSkeletonGrid } from "@/components/Skeleton";
import { fetchAdminWeeklyAnalytics, formatRevenue } from "@/lib/adminService";

const tooltipStyle = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: "12px",
  fontSize: "12px",
};

export default function AdminAnalytics() {
  const [weeks, setWeeks] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      setWeeks(await fetchAdminWeeklyAnalytics());
    } catch (e) {
      setError(e?.message || "Failed to load analytics");
      setWeeks(null);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchAdminWeeklyAnalytics();
        if (active) setWeeks(data);
      } catch (e) {
        if (!active) return;
        setError(e?.message || "Failed to load analytics");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell title="Analytics">
      {error ? (
        <ErrorState title="Couldn’t load analytics" description={error} onRetry={load} />
      ) : !weeks ? (
        <StatSkeletonGrid count={3} />
      ) : (
        <div className="space-y-8" data-testid="admin-analytics">
          <section className="border skl-border rounded-2xl p-5 md:p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              New users per week
            </h2>
            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="users" name="Users" stroke="#000" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="border skl-border rounded-2xl p-5 md:p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Jobs created per week
            </h2>
            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f5f5" }} />
                  <Bar dataKey="jobs" name="Jobs" fill="#000" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="border skl-border rounded-2xl p-5 md:p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Applications per week
            </h2>
            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f5f5" }} />
                  <Bar dataKey="applications" name="Applications" fill="#000" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="border skl-border rounded-2xl p-5 md:p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Revenue trend
            </h2>
            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => formatRevenue(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#000" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

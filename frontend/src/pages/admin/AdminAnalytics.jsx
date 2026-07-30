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
import { StatSkeletonGrid } from "@/components/Skeleton";
import { getAdminAnalytics, subscribeAdmin } from "@/lib/mockAdmin";

const tooltipStyle = {
  background: "#fff",
  border: "1px solid #e5e5e5",
  borderRadius: "12px",
  fontSize: "12px",
};

export default function AdminAnalytics() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = () => setData(getAdminAnalytics());
    load();
    return subscribeAdmin(load);
  }, []);

  return (
    <AdminShell title="Analytics">
      {!data ? (
        <StatSkeletonGrid count={3} />
      ) : (
        <div className="space-y-8" data-testid="admin-analytics">
          <section className="border skl-border rounded-2xl p-5 md:p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Jobs by category
            </h2>
            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.jobs_by_category} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f5f5" }} />
                  <Bar dataKey="value" name="Jobs" fill="#000" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.jobs_by_category.map((c) => (
                <div key={c.name} className="border skl-border rounded-xl px-3 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500">{c.name}</div>
                  <div className="text-sm font-medium mt-0.5">{c.value}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="border skl-border rounded-2xl p-5 md:p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Monthly signups
            </h2>
            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthly_signups} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="students"
                    name="Students"
                    stroke="#000"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="clients"
                    name="Clients"
                    stroke="#737373"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="border skl-border rounded-2xl p-5 md:p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Monthly completed projects
            </h2>
            <div className="mt-6 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly_completed} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f5f5" }} />
                  <Bar dataKey="completed" name="Completed" fill="#000" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
}

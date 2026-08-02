/**
 * Supabase Admin analytics & moderation (admin role only).
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

function assertClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

export function formatAdminDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatRevenue(amount) {
  const n = Number(amount) || 0;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export async function fetchAdminOverview() {
  const client = assertClient();
  const { data, error } = await client.rpc("admin_overview_stats");
  if (error) throw error;
  const s = data || {};
  return {
    total_users: Number(s.total_users) || 0,
    total_students: Number(s.total_students) || 0,
    total_clients: Number(s.total_clients) || 0,
    total_jobs: Number(s.total_jobs) || 0,
    total_applications: Number(s.total_applications) || 0,
    total_payments: Number(s.total_payments) || 0,
    total_revenue: Number(s.total_revenue) || 0,
    suspended_users: Number(s.suspended_users) || 0,
    total_reviews: Number(s.total_reviews) || 0,
  };
}

export async function fetchAdminWeeklyAnalytics() {
  const client = assertClient();
  const { data, error } = await client.rpc("admin_weekly_analytics");
  if (error) throw error;
  const weeks = Array.isArray(data?.weeks) ? data.weeks : [];
  return weeks.map((w) => ({
    week: w.week,
    users: Number(w.users) || 0,
    jobs: Number(w.jobs) || 0,
    applications: Number(w.applications) || 0,
    revenue: Number(w.revenue) || 0,
  }));
}

function mapAdminUser(u) {
  return {
    id: u.id,
    name: u.full_name || "User",
    role: u.role,
    status: u.status || "active",
    joined_at: u.created_at,
    average_rating: Number(u.average_rating) || 0,
    review_count: Number(u.review_count) || 0,
    email: "",
  };
}

export async function fetchAdminUsers({ role = "all", status = "all", q = "", limit = 100 } = {}) {
  const client = assertClient();
  let query = client
    .from("profiles")
    .select("id, full_name, role, status, created_at, average_rating, review_count")
    .in("role", ["student", "client"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (role === "student" || role === "client") query = query.eq("role", role);
  if (status === "active" || status === "suspended") query = query.eq("status", status);
  const needle = String(q || "").trim();
  if (needle) query = query.ilike("full_name", `%${needle.replace(/[%_]/g, "")}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapAdminUser);
}

/** Role tab counts — one light query. */
export async function fetchAdminUserCounts() {
  const client = assertClient();
  const { data, error } = await client
    .from("profiles")
    .select("role")
    .in("role", ["student", "client"]);
  if (error) throw error;
  const list = data || [];
  return {
    all: list.length,
    student: list.filter((u) => u.role === "student").length,
    client: list.filter((u) => u.role === "client").length,
  };
}

export async function adminSetUserStatus(userId, status) {
  const client = assertClient();
  const { data, error } = await client.rpc("admin_set_user_status", {
    p_user_id: userId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

export async function fetchAdminJobs({ status = "all", q = "", limit = 100 } = {}) {
  const client = assertClient();
  let query = client
    .from("jobs")
    .select(
      `
      id, title, budget, category, status, created_at, client_id,
      profiles:client_id ( id, full_name )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  const needle = String(q || "").trim().toLowerCase();
  return (data || [])
    .map((j) => ({
      id: j.id,
      title: j.title,
      budget: j.budget,
      category: j.category,
      status: j.status,
      created_at: j.created_at,
      company_name: j.profiles?.full_name || "Client",
      client_id: j.client_id,
    }))
    .filter((j) => {
      if (!needle) return true;
      return (
        j.title.toLowerCase().includes(needle) ||
        j.company_name.toLowerCase().includes(needle) ||
        (j.category || "").toLowerCase().includes(needle)
      );
    });
}

export async function adminDeleteJob(jobId) {
  const client = assertClient();
  const { error } = await client.rpc("admin_delete_job", { p_job_id: jobId });
  if (error) throw error;
}

export async function fetchAdminApplications({ status = "all", limit = 100 } = {}) {
  const client = assertClient();
  let query = client
    .from("applications")
    .select(
      `
      id, status, bid_amount, estimated_days, created_at, freelancer_id, job_id,
      profiles!applications_freelancer_profile_fkey ( id, full_name ),
      jobs!applications_job_id_fkey ( id, title, client_id )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((a) => ({
    id: a.id,
    status: a.status,
    bid_amount: Number(a.bid_amount) || 0,
    estimated_days: a.estimated_days,
    created_at: a.created_at,
    freelancer_name: a.profiles?.full_name || "Student",
    freelancer_id: a.freelancer_id,
    job_title: a.jobs?.title || "Job",
    job_id: a.job_id || a.jobs?.id,
  }));
}

export async function fetchAdminReviews({ limit = 100 } = {}) {
  const client = assertClient();
  const { data, error } = await client
    .from("reviews")
    .select(
      `
      id, rating, review, created_at, reviewer_id, reviewee_id, application_id,
      reviewer:profiles!reviews_reviewer_profile_fkey ( id, full_name ),
      reviewee:profiles!reviews_reviewee_profile_fkey ( id, full_name )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data || []).map((r) => ({
    id: r.id,
    rating: Number(r.rating) || 0,
    review: r.review || "",
    created_at: r.created_at,
    reviewer_name: r.reviewer?.full_name || "User",
    reviewee_name: r.reviewee?.full_name || "User",
    reviewer_id: r.reviewer_id,
    reviewee_id: r.reviewee_id,
  }));
}

export async function adminDeleteReview(reviewId) {
  const client = assertClient();
  const { error } = await client.rpc("admin_delete_review", { p_review_id: reviewId });
  if (error) throw error;
}

export async function fetchAdminAuditLogs({ limit = 40 } = {}) {
  const client = assertClient();
  const { data, error } = await client
    .from("admin_audit_logs")
    .select("id, admin_id, action, entity_type, entity_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export function labelAuditAction(action) {
  const map = {
    suspend_user: "Suspended user",
    reactivate_user: "Reactivated user",
    delete_job: "Deleted job",
    delete_review: "Removed review",
  };
  return map[action] || action;
}

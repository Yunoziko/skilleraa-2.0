/**
 * Supabase Applications API.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { ensureProfile } from "@/lib/profilesService";
import { mapJobRow } from "@/lib/jobsService";

function assertClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

export const APPLICATION_STATUSES = ["pending", "accepted", "rejected", "completed"];

export function displayApplicationStatus(status) {
  const s = String(status || "pending").toLowerCase();
  if (s === "accepted" || s === "hired") return "Accepted";
  if (s === "rejected") return "Rejected";
  if (s === "completed") return "Completed";
  return "Pending";
}

/** Chat is enabled after accept (and remains after completion). */
export function isChatEnabled(status) {
  const s = String(status || "").toLowerCase();
  return s === "accepted" || s === "hired" || s === "completed";
}

export function isApplicationCompleted(status) {
  return String(status || "").toLowerCase() === "completed";
}

/** Parse bid amounts like "10000", "₹10,000", "10.5k" into a number. */
export function parseBidAmount(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const text = String(raw || "").trim().toLowerCase().replace(/,/g, "");
  if (!text) return NaN;
  const match = text.match(/(\d+(\.\d+)?)/);
  if (!match) return NaN;
  let n = Number(match[1]);
  if (/k\b/.test(text)) n *= 1000;
  return n;
}

export function mapApplicationRow(row) {
  if (!row) return null;
  const profile = row.profiles || row.freelancer || null;
  const jobRaw = row.jobs || row.job || null;
  const job = jobRaw ? mapJobRow(jobRaw) : null;
  const name = profile?.full_name || "Freelancer";
  return {
    id: row.id,
    job_id: row.job_id,
    freelancer_id: row.freelancer_id,
    proposal: row.proposal || "",
    cover_letter: row.proposal || "",
    bid_amount: Number(row.bid_amount) || 0,
    expected_budget: row.bid_amount != null ? `₹${Number(row.bid_amount).toLocaleString("en-IN")}` : "",
    estimated_days: Number(row.estimated_days) || 0,
    delivery_time: row.estimated_days ? `${row.estimated_days} day${row.estimated_days === 1 ? "" : "s"}` : "",
    status: row.status || "pending",
    created_at: row.created_at,
    job,
    student: profile
      ? {
          id: profile.id,
          name,
          avatar_letter: (name || "F").charAt(0).toUpperCase(),
          headline: profile.role === "student" ? "Student freelancer" : "",
          skills: [],
        }
      : null,
  };
}

const APP_SELECT = `
  id,
  job_id,
  freelancer_id,
  proposal,
  bid_amount,
  estimated_days,
  status,
  created_at,
  jobs!applications_job_id_fkey (
    id,
    client_id,
    title,
    description,
    budget,
    category,
    skills,
    location,
    job_type,
    duration,
    experience,
    status,
    created_at,
    updated_at,
    profiles!jobs_client_id_fkey (
      id,
      full_name,
      role,
      avatar_url
    )
  ),
  profiles!applications_freelancer_profile_fkey (
    id,
    full_name,
    role,
    avatar_url
  )
`;

export async function hasApplied(jobId, freelancerId) {
  const client = assertClient();
  let uid = freelancerId;
  if (!uid) {
    const { data: auth } = await client.auth.getUser();
    uid = auth?.user?.id;
  }
  if (!uid || !jobId) return false;
  const { data, error } = await client
    .from("applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("freelancer_id", uid)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function createApplication({
  jobId,
  proposal,
  bidAmount,
  estimatedDays,
}) {
  const client = assertClient();
  const profile = await ensureProfile();
  if (!profile?.id) throw new Error("You must be signed in to apply.");
  if (profile.role !== "student") {
    throw new Error("Only student freelancers can apply to jobs.");
  }

  const amount = parseBidAmount(bidAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid bid amount.");
  }
  const days = Number.parseInt(String(estimatedDays), 10);
  if (!Number.isFinite(days) || days < 1) {
    throw new Error("Estimated delivery days must be at least 1.");
  }
  const text = String(proposal || "").trim();
  if (text.length < 20) {
    throw new Error("Proposal must be at least 20 characters.");
  }

  const { data, error } = await client
    .from("applications")
    .insert({
      job_id: jobId,
      freelancer_id: profile.id,
      proposal: text,
      bid_amount: amount,
      estimated_days: days,
      status: "pending",
    })
    .select(APP_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("You have already applied to this job.");
    }
    throw error;
  }
  return mapApplicationRow(data);
}

/** Applications submitted by the signed-in freelancer. */
export async function fetchMyApplications() {
  const client = assertClient();
  const { data: auth } = await client.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("You must be signed in.");

  const { data, error } = await client
    .from("applications")
    .select(APP_SELECT)
    .eq("freelancer_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapApplicationRow);
}

/** Applications for jobs owned by the signed-in client (optionally filter by job). */
export async function fetchClientApplications(jobId) {
  const client = assertClient();
  let query = client
    .from("applications")
    .select(APP_SELECT)
    .order("created_at", { ascending: false });

  if (jobId) query = query.eq("job_id", jobId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapApplicationRow);
}

export async function updateApplicationStatus(id, status) {
  const client = assertClient();
  const next = String(status || "").toLowerCase();
  if (!APPLICATION_STATUSES.includes(next)) {
    throw new Error("Invalid application status.");
  }
  const { data, error } = await client
    .from("applications")
    .update({ status: next })
    .eq("id", id)
    .select(APP_SELECT)
    .single();
  if (error) throw error;
  return mapApplicationRow(data);
}

/** Client marks an accepted application as completed (unlocks reviews). */
export async function markApplicationCompleted(id) {
  return updateApplicationStatus(id, "completed");
}

export async function studentApplicationStats() {
  const list = await fetchMyApplications();
  return {
    applications: list.length,
    pending: list.filter((a) => a.status === "pending").length,
    accepted: list.filter((a) => a.status === "accepted").length,
    rejected: list.filter((a) => a.status === "rejected").length,
  };
}

/** @type {Set<(payload: object) => void>} */
const applicationListeners = new Set();
/** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
let applicationsChannel = null;
let applicationsChannelRefCount = 0;

/**
 * Shared Realtime subscription for application row changes (accept/reject).
 * Returns unsubscribe.
 */
export function subscribeApplications(onChange) {
  if (!supabase || !isSupabaseConfigured) return () => {};
  if (typeof onChange !== "function") return () => {};

  applicationListeners.add(onChange);
  applicationsChannelRefCount += 1;

  if (!applicationsChannel) {
    applicationsChannel = supabase
      .channel("skl-applications-shared")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications" },
        (payload) => {
          applicationListeners.forEach((fn) => {
            try {
              fn(payload);
            } catch {
              // ignore listener errors
            }
          });
        }
      )
      .subscribe();
  }

  return () => {
    applicationListeners.delete(onChange);
    applicationsChannelRefCount = Math.max(0, applicationsChannelRefCount - 1);
    if (applicationsChannelRefCount === 0 && applicationsChannel) {
      supabase.removeChannel(applicationsChannel);
      applicationsChannel = null;
    }
  };
}

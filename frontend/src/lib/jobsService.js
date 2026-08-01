/**
 * Supabase Jobs API — replaces mock/FastAPI job listing for browse, detail, create.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { ensureProfile } from "@/lib/profilesService";

function assertClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

/** Map DB row (+ optional profile) to the UI job shape used by JobCard / JobDetail. */
export function mapJobRow(row) {
  if (!row) return null;
  const profile = row.profiles || row.client || null;
  const fullName = profile?.full_name || row.company_name || "Client";
  const jobType = (row.job_type || "remote").toLowerCase();
  return {
    id: row.id,
    client_id: row.client_id,
    title: row.title,
    description: row.description || "",
    budget: row.budget || "",
    category: row.category || "Other",
    skills: Array.isArray(row.skills) ? row.skills : [],
    location: row.location || "",
    job_type: jobType,
    remote: jobType === "remote" || jobType === "hybrid",
    duration: row.duration || "",
    experience: row.experience || "Beginner",
    status: row.status || "open",
    company_name: fullName,
    company_letter: (fullName || "C").charAt(0).toUpperCase(),
    created_at: row.created_at,
    updated_at: row.updated_at,
    applications_count: row.applications_count ?? 0,
  };
}

const JOB_SELECT = `
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
  profiles:client_id (
    id,
    full_name,
    role,
    avatar_url
  )
`;

/**
 * Fetch jobs with optional filters.
 * @param {{ q?: string, category?: string, experience?: string, remote?: boolean|null, status?: string }} filters
 */
export async function fetchJobs(filters = {}) {
  const client = assertClient();
  let query = client
    .from("jobs")
    .select(JOB_SELECT)
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  } else {
    // Public browse defaults to open listings
    query = query.eq("status", "open");
  }

  if (filters.category && filters.category !== "All") {
    query = query.eq("category", filters.category);
  }

  if (filters.experience && filters.experience !== "All") {
    query = query.eq("experience", filters.experience);
  }

  if (filters.remote === true) {
    query = query.in("job_type", ["remote", "hybrid"]);
  } else if (filters.remote === false) {
    query = query.eq("job_type", "onsite");
  }

  const rawQ = (filters.q || "").trim();
  if (rawQ) {
    const safe = rawQ.replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    if (safe) {
      query = query.or(
        `title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%,location.ilike.%${safe}%`
      );
    }
  }

  // Cap browse results; detail/my-jobs use dedicated fetchers
  query = query.limit(filters.limit || 100);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(mapJobRow);
}

/** Fetch a single job by id. */
export async function fetchJobById(id) {
  const client = assertClient();
  const { data, error } = await client
    .from("jobs")
    .select(JOB_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapJobRow(data);
}

/** Jobs posted by the current (or given) client. */
export async function fetchMyJobs(clientId) {
  const client = assertClient();
  let uid = clientId;
  if (!uid) {
    const { data: auth } = await client.auth.getUser();
    uid = auth?.user?.id;
  }
  if (!uid) throw new Error("You must be signed in to view your jobs.");

  const { data, error } = await client
    .from("jobs")
    .select(JOB_SELECT)
    .eq("client_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(mapJobRow);
}

/**
 * Create a job as the authenticated client.
 * Ensures a profiles row exists first (RLS requires client role).
 */
export async function createJob(input) {
  const client = assertClient();
  const profile = await ensureProfile();
  if (!profile?.id) throw new Error("Could not load your client profile.");
  if (profile.role !== "client") {
    throw new Error("Only client accounts can post jobs. Sign up as a client first.");
  }

  const skills = Array.isArray(input.skills)
    ? input.skills
    : String(input.skills || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  const remote = input.remote !== false;
  const jobType =
    input.job_type ||
    (remote ? "remote" : input.location ? "onsite" : "remote");

  const payload = {
    client_id: profile.id,
    title: String(input.title || "").trim(),
    description: String(input.description || "").trim(),
    budget: String(input.budget || "").trim(),
    category: input.category || "Other",
    skills,
    location: remote ? "" : String(input.location || "").trim(),
    job_type: jobType,
    duration: String(input.duration || "").trim(),
    experience: input.experience || "Beginner",
    status: "open",
  };

  if (!payload.title) throw new Error("Job title is required.");
  if (!payload.description) throw new Error("Description is required.");
  if (!payload.budget) throw new Error("Budget is required.");

  const { data, error } = await client
    .from("jobs")
    .insert(payload)
    .select(JOB_SELECT)
    .single();

  if (error) throw error;
  return mapJobRow(data);
}

/** Update own job (owner-only via RLS). */
export async function updateJob(id, patch) {
  const client = assertClient();
  const { data, error } = await client
    .from("jobs")
    .update(patch)
    .eq("id", id)
    .select(JOB_SELECT)
    .single();
  if (error) throw error;
  return mapJobRow(data);
}

/** Delete own job (owner-only via RLS). */
export async function deleteJob(id) {
  const client = assertClient();
  const { error } = await client.from("jobs").delete().eq("id", id);
  if (error) throw error;
  return true;
}

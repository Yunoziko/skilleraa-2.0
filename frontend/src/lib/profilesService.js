/**
 * Supabase profiles helpers (linked to auth.users).
 */

import { supabase, isSupabaseConfigured, resolveAuthRole } from "@/lib/supabase";

function assertClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

export async function getProfile(userId) {
  const client = assertClient();
  const { data, error } = await client
    .from("profiles")
    .select(
      "id, full_name, role, status, avatar_url, resume_url, portfolio_url, average_rating, review_count, created_at"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Ensure the signed-in user has a profiles row.
 * Creates from auth metadata when missing. Role is immutable after create.
 */
export async function ensureProfile({ name, role } = {}) {
  const client = assertClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const user = authData?.user;
  if (!user) throw new Error("You must be signed in.");

  const meta = user.user_metadata || {};
  // Never create admin via client signup metadata (resolveAuthRole ignores admin)
  const createRole = resolveAuthRole(role, meta.role, meta.intended_role) === "client"
    ? "client"
    : "student";
  const resolvedName = String(
    name || meta.full_name || meta.name || user.email?.split("@")[0] || ""
  ).trim();
  const googleAvatar = String(meta.avatar_url || meta.picture || "").trim();

  const existing = await getProfile(user.id);
  if (existing) {
    // One-time OAuth signup role claim (student ↔ client within 24h, no activity)
    if (
      (createRole === "client" || createRole === "student") &&
      existing.role !== createRole &&
      existing.role !== "admin"
    ) {
      try {
        const { data: claimed, error: claimErr } = await client.rpc("claim_signup_role", {
          p_role: createRole,
        });
        if (!claimErr && claimed) {
          return { ...existing, ...claimed, status: claimed.status || existing.status || "active" };
        }
      } catch {
        // Role locked or ineligible — keep existing
      }
    }

    const patch = {};
    if (resolvedName && existing.full_name !== resolvedName) {
      patch.full_name = resolvedName;
    }
    // Fill avatar once from Google; never overwrite a user-set avatar
    if (googleAvatar && !existing.avatar_url) {
      patch.avatar_url = googleAvatar;
    }
    if (Object.keys(patch).length > 0) {
      const { data, error } = await client
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select("id, full_name, role, status, avatar_url, resume_url, portfolio_url, created_at")
        .single();
      if (error) throw error;
      return { ...data, status: data.status || existing.status || "active" };
    }
    return existing;
  }

  // Insert-only: trigger may race; never overwrite role on conflict
  const { data, error } = await client
    .from("profiles")
    .insert({
      id: user.id,
      full_name: resolvedName,
      role: createRole,
      ...(googleAvatar ? { avatar_url: googleAvatar } : {}),
    })
    .select("id, full_name, role, status, avatar_url, created_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      const again = await getProfile(user.id);
      if (again) return again;
    }
    throw error;
  }
  return data || getProfile(user.id);
}

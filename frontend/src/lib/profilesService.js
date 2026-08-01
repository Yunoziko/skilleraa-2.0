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
      "id, full_name, role, avatar_url, resume_url, portfolio_url, average_rating, review_count, created_at"
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
  const resolvedRole = resolveAuthRole(role, meta.role, meta.intended_role);
  const resolvedName = String(
    name || meta.full_name || meta.name || user.email?.split("@")[0] || ""
  ).trim();

  const existing = await getProfile(user.id);
  if (existing) {
    if (resolvedName && existing.full_name !== resolvedName) {
      const { data, error } = await client
        .from("profiles")
        .update({ full_name: resolvedName })
        .eq("id", user.id)
        .select("id, full_name, role, avatar_url, created_at")
        .single();
      if (error) throw error;
      return data;
    }
    return existing;
  }

  const { data, error } = await client
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: resolvedName,
        role: resolvedRole,
        avatar_url: null,
      },
      { onConflict: "id" }
    )
    .select("id, full_name, role, avatar_url, created_at")
    .single();

  if (error) throw error;
  return data;
}

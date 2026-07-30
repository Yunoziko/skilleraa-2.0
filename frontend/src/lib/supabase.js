import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || "";
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

/** True only when env vars look like real Supabase credentials (not PLACEHOLDER_*). */
export function hasRealSupabaseConfig(url = supabaseUrl, key = supabaseAnonKey) {
  if (!url || !key) return false;
  const bad = (v) =>
    !v ||
    /placeholder/i.test(v) ||
    v.includes("YOUR_PROJECT") ||
    v.includes("your-anon") ||
    v.includes("your-publishable");
  if (bad(url) || bad(key)) return false;
  return url.startsWith("https://") || url.startsWith("http://");
}

export const isSupabaseConfigured = hasRealSupabaseConfig();

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    })
  : null;

export const AUTH_CALLBACK_PATH = "/auth/callback";
export const RESET_PASSWORD_PATH = "/reset-password";
export const PENDING_ROLE_KEY = "skl_pending_role";
export const PENDING_VERIFY_EMAIL_KEY = "skl_pending_verify_email";

export function getAuthRedirectUrl(path = AUTH_CALLBACK_PATH) {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function setPendingRole(role) {
  if (typeof window === "undefined") return;
  if (role === "student" || role === "client") {
    sessionStorage.setItem(PENDING_ROLE_KEY, role);
  }
}

export function consumePendingRole(fallback = "student") {
  if (typeof window === "undefined") return fallback;
  const role = sessionStorage.getItem(PENDING_ROLE_KEY);
  sessionStorage.removeItem(PENDING_ROLE_KEY);
  return role === "client" || role === "student" ? role : fallback;
}

export function setPendingVerifyEmail(email) {
  if (typeof window === "undefined" || !email) return;
  sessionStorage.setItem(PENDING_VERIFY_EMAIL_KEY, email.trim().toLowerCase());
}

export function getPendingVerifyEmail() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(PENDING_VERIFY_EMAIL_KEY) || "";
}

export function clearPendingVerifyEmail() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_VERIFY_EMAIL_KEY);
}

export function clearPendingRole() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PENDING_ROLE_KEY);
}

export function clearAuthEphemeralState() {
  clearPendingVerifyEmail();
  clearPendingRole();
}

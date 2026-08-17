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

/**
 * Reusable browser Supabase client.
 * Session is persisted in localStorage and restored on refresh.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        storageKey: "skl-supabase-auth",
      },
    })
  : null;

export const AUTH_CALLBACK_PATH = "/auth/callback";
export const RESET_PASSWORD_PATH = "/reset-password";
export const PENDING_ROLE_KEY = "skl_pending_role";
export const PENDING_VERIFY_EMAIL_KEY = "skl_pending_verify_email";

/** Canonical production site for email / OAuth redirects. */
export const PRODUCTION_SITE_ORIGIN = "https://www.skilleraa.com";

const CANONICAL_AUTH_HOSTS = new Set(["www.skilleraa.com", "skilleraa.com"]);

export function getAuthRedirectUrl(path = AUTH_CALLBACK_PATH) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") {
    return `${PRODUCTION_SITE_ORIGIN}${normalized}`;
  }
  // Apex and www both redirect to the canonical production origin.
  // Localhost and Vercel previews keep their current origin.
  if (CANONICAL_AUTH_HOSTS.has(window.location.hostname)) {
    return `${PRODUCTION_SITE_ORIGIN}${normalized}`;
  }
  return `${window.location.origin}${normalized}`;
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

/** Normalize signup/session role. Never trust client metadata for admin. */
export function resolveAuthRole(...candidates) {
  for (const c of candidates) {
    if (c === "client" || c === "student") return c;
  }
  return "student";
}

/** App role including admin — only when read from DB profile (or trusted override). */
export function resolveAppRole(dbRole, ...fallbacks) {
  if (dbRole === "admin" || dbRole === "client" || dbRole === "student") return dbRole;
  return resolveAuthRole(...fallbacks);
}

/** Map a Supabase auth user into the Skilleraa app user shape (no backend required). */
export function mapSupabaseUser(sbUser, overrides = {}) {
  if (!sbUser) return null;
  const meta = sbUser.user_metadata || {};
  const role = resolveAuthRole(overrides.role, meta.role, meta.intended_role);
  const name = String(
    overrides.name ||
      meta.full_name ||
      meta.name ||
      meta.preferred_username ||
      sbUser.email?.split("@")[0] ||
      "User",
  ).trim();
  const avatarUrl = String(
    overrides.avatar_url || meta.avatar_url || meta.picture || "",
  ).trim();
  return {
    id: sbUser.id,
    email: sbUser.email || "",
    name,
    role,
    avatar_url: avatarUrl,
    avatar_letter: name.charAt(0).toUpperCase() || "U",
    created_at: sbUser.created_at || null,
    headline: meta.headline || "",
    bio: meta.bio || "",
    location: meta.location || "",
    skills: Array.isArray(meta.skills) ? meta.skills : [],
    portfolio_url: meta.portfolio_url || "",
    education: meta.education || "",
  };
}

const OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function readRedirectParams() {
  if (typeof window === "undefined") {
    return { search: new URLSearchParams(), hash: new URLSearchParams(), get: () => null };
  }
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const get = (key) => search.get(key) || hash.get(key);
  return { search, hash, get };
}

function clearAuthParamsFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    [
      "code",
      "token_hash",
      "type",
      "error",
      "error_code",
      "error_description",
    ].forEach((k) => url.searchParams.delete(k));
    url.hash = "";
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  } catch {
    // ignore
  }
}

/**
 * Complete email-confirm / OAuth / magic-link redirects.
 * Handles: ?code= (PKCE), #access_token= (implicit), ?token_hash=&type= (OTP).
 */
export async function completeAuthRedirect(client = supabase) {
  if (!client) {
    return { session: null, error: "Supabase is not configured." };
  }

  // Let detectSessionInUrl finish before we read/exchange params.
  if (typeof client.auth.initialize === "function") {
    try {
      await client.auth.initialize();
    } catch {
      // continue — we still try manual recovery below
    }
  }

  const { get } = readRedirectParams();

  const redirectError = get("error_description") || get("error");
  if (redirectError) {
    return { session: null, error: redirectError };
  }

  // 1) token_hash (common for email confirmation / resend links)
  const tokenHash = get("token_hash");
  const rawType = get("type");
  if (tokenHash && rawType) {
    const otpType = OTP_TYPES.has(rawType) ? rawType : "email";
    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (error) return { session: null, error: error.message || "Email verification failed." };
    if (data?.session) {
      clearAuthParamsFromUrl();
      return { session: data.session, error: null };
    }
  }

  // 2) PKCE auth code (OAuth + some email confirm templates)
  const code = get("code");
  if (code) {
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (!error && data?.session) {
      clearAuthParamsFromUrl();
      return { session: data.session, error: null };
    }
    // If exchange fails (e.g. code already used by initialize), fall through to getSession.
  }

  // 3) Implicit grant tokens in hash or query
  const accessToken = get("access_token");
  const refreshToken = get("refresh_token");
  if (accessToken && refreshToken) {
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { session: null, error: error.message || "Could not restore session." };
    if (data?.session) {
      clearAuthParamsFromUrl();
      return { session: data.session, error: null };
    }
  }

  // 4) Session may already be stored by detectSessionInUrl / initialize
  for (let i = 0; i < 12; i += 1) {
    const { data, error } = await client.auth.getSession();
    if (error) return { session: null, error: error.message };
    if (data?.session) {
      clearAuthParamsFromUrl();
      return { session: data.session, error: null };
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  return {
    session: null,
    error: "No session found. Try signing in again.",
  };
}

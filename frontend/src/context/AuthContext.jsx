import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import api, { saveTokens, clearToken, formatApiError } from "@/lib/api";
import {
  supabase,
  isSupabaseConfigured,
  getAuthRedirectUrl,
  setPendingRole,
  consumePendingRole,
  clearPendingRole,
  setPendingVerifyEmail,
  getPendingVerifyEmail,
  clearPendingVerifyEmail,
  clearAuthEphemeralState,
  mapSupabaseUser,
  resolveAuthRole,
  resolveAppRole,
  completeAuthRedirect,
  AUTH_CALLBACK_PATH,
  RESET_PASSWORD_PATH,
} from "@/lib/supabase";
import { ensureProfile } from "@/lib/profilesService";

const AuthContext = createContext(null);

function authErrorMessage(error) {
  if (!error) return "Something went wrong. Please try again.";
  if (typeof error === "string") return error;
  const msg = error.message || "";
  // Safari: "Load failed" / Chrome: "Failed to fetch" — network/DNS/CORS to Supabase or API
  if (
    /load failed/i.test(msg) ||
    /failed to fetch/i.test(msg) ||
    /networkerror/i.test(msg) ||
    /network request failed/i.test(msg) ||
    error.name === "TypeError"
  ) {
    return "Cannot reach authentication service. Check your connection and that Supabase is online, then try again.";
  }
  return msg || "Something went wrong. Please try again.";
}

function notConfiguredError() {
  return {
    ok: false,
    error:
      "Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in frontend/.env and restart the app.",
  };
}

/** Optional FastAPI profile sync — never blocks Supabase auth if backend is down. */
async function trySyncProfile({ name, role } = {}) {
  try {
    const body = {};
    if (name) body.name = name;
    if (role === "student" || role === "client") body.role = role;
    const { data } = await api.post("/auth/sync", body);
    return data || null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=logged out, object=logged in
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const appliedTokenRef = useRef(null);

  const applySession = useCallback(async (nextSession, { name, role, force = false } = {}) => {
    if (!nextSession?.access_token) {
      clearToken();
      appliedTokenRef.current = null;
      setSession(null);
      setUser(false);
      return null;
    }

    saveTokens(nextSession.access_token, nextSession.refresh_token);
    setSession(nextSession);

    if (!force && !name && !role && appliedTokenRef.current === nextSession.access_token) {
      return undefined;
    }

    const storedPending = consumePendingRole(null);
    const roleOverride =
      role === "client" || role === "student"
        ? role
        : storedPending === "client" || storedPending === "student"
          ? storedPending
          : null;

    let sbUser = nextSession.user;

    // Persist role/name into user_metadata when explicitly provided (signup / OAuth pending)
    if (supabase && (roleOverride || name)) {
      try {
        const meta = sbUser?.user_metadata || {};
        const needsRole = roleOverride && meta.role !== roleOverride;
        const trimmedName = name?.trim();
        const needsName = trimmedName && meta.name !== trimmedName;
        if (needsRole || needsName) {
          const { data: updated, error } = await supabase.auth.updateUser({
            data: {
              ...(needsName ? { name: trimmedName } : {}),
              ...(needsRole ? { role: roleOverride, intended_role: roleOverride } : {}),
            },
          });
          if (!error && updated?.user) sbUser = updated.user;
        }
      } catch {
        // keep session.user
      }
    }

    let profile = mapSupabaseUser(sbUser, {
      name: name || undefined,
      role: roleOverride || undefined,
    });

    // Ensure Supabase public.profiles row (used by jobs RLS / client_id)
    try {
      const dbProfile = await ensureProfile({
        name: profile?.name,
        role: roleOverride || profile?.role,
      });
      if (dbProfile) {
        if (dbProfile.status === "suspended") {
          try {
            await supabase.auth.signOut();
          } catch {
            /* ignore */
          }
          clearToken();
          appliedTokenRef.current = null;
          setSession(null);
          setUser(false);
          return { suspended: true };
        }
        profile = {
          ...profile,
          id: dbProfile.id || profile?.id,
          name: dbProfile.full_name || profile?.name,
          role: resolveAppRole(dbProfile.role, profile?.role),
          status: dbProfile.status || "active",
          avatar_url: dbProfile.avatar_url || profile?.avatar_url || "",
        };
      }
    } catch {
      // Trigger may already have created the row; auth still works
    }

    // Soft-merge FastAPI profile extras only — never replace Supabase id/role
    const supabaseId = profile?.id;
    const supabaseRole = profile?.role;
    const backendProfile = await trySyncProfile({
      name: profile?.name,
      role: profile?.role === "admin" ? undefined : profile?.role,
    });
    if (backendProfile && typeof backendProfile === "object") {
      const {
        id: _mongoId,
        role: _mongoRole,
        ...backendExtras
      } = backendProfile;
      profile = {
        ...profile,
        ...backendExtras,
        id: supabaseId,
        role: resolveAppRole(supabaseRole, profile?.role),
        name: backendExtras.name || profile?.name,
      };
    }

    appliedTokenRef.current = nextSession.access_token;
    clearPendingVerifyEmail();
    setUser(profile);
    return profile;
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setUser(false);
      return null;
    }
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        clearToken();
        appliedTokenRef.current = null;
        setSession(null);
        setUser(false);
        return null;
      }
      return await applySession(data.session, { force: true });
    } catch {
      setUser(false);
      return null;
    }
  }, [applySession]);

  useEffect(() => {
    if (!supabase) {
      setUser(false);
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    (async () => {
      await refresh();
      if (mounted) setLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        clearToken();
        clearAuthEphemeralState();
        appliedTokenRef.current = null;
        setSession(null);
        setUser(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" && nextSession) {
        saveTokens(nextSession.access_token, nextSession.refresh_token);
        setSession(nextSession);
        return;
      }

      // Recovery session is owned by ResetPassword — keep tokens, do not map profile yet
      if (event === "PASSWORD_RECOVERY" && nextSession) {
        saveTokens(nextSession.access_token, nextSession.refresh_token);
        setSession(nextSession);
        return;
      }

      if (nextSession) {
        saveTokens(nextSession.access_token, nextSession.refresh_token);
        setSession(nextSession);
        if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
          try {
            await applySession(nextSession);
          } catch {
            // boot refresh / login callers surface errors
          }
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applySession, refresh]);

  const login = async (email, password) => {
    if (!supabase) return notConfiguredError();
    try {
      const normalized = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalized,
        password,
      });
      if (error) {
        const msg = authErrorMessage(error);
        const needsVerification =
          /confirm|verified|verification/i.test(msg) || /email not confirmed/i.test(msg);
        if (needsVerification) setPendingVerifyEmail(normalized);
        return { ok: false, error: msg, needsVerification };
      }
      if (data.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut({ scope: "local" });
        setPendingVerifyEmail(normalized);
        return {
          ok: false,
          error:
            "Please verify your email before logging in. Check your inbox for the confirmation link.",
          needsVerification: true,
        };
      }
      const profile = await applySession(data.session, { force: true });
      if (profile?.suspended) {
        return { ok: false, error: "This account has been suspended. Contact support." };
      }
      return { ok: true, user: profile };
    } catch (e) {
      return {
        ok: false,
        error:
          (e?.response?.data?.detail != null
            ? formatApiError(e.response.data.detail)
            : null) || authErrorMessage(e),
      };
    }
  };

  const register = async (name, email, password, role) => {
    if (!supabase) return notConfiguredError();
    try {
      const normalized = email.trim().toLowerCase();
      const resolvedRole = resolveAuthRole(role);
      setPendingRole(resolvedRole);
      setPendingVerifyEmail(normalized);

      const { data, error } = await supabase.auth.signUp({
        email: normalized,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(AUTH_CALLBACK_PATH),
          data: {
            name: name?.trim() || "",
            role: resolvedRole,
            intended_role: resolvedRole,
          },
        },
      });
      if (error) return { ok: false, error: authErrorMessage(error) };

      // Supabase returns empty identities when the email is already registered
      if (data.user?.identities && data.user.identities.length === 0) {
        clearPendingVerifyEmail();
        return {
          ok: false,
          error: "An account with this email already exists. Please log in.",
        };
      }

      if (!data.session) {
        return {
          ok: true,
          needsVerification: true,
          user: null,
          message: "Check your email to verify your account before signing in.",
        };
      }

      const profile = await applySession(data.session, {
        name: name?.trim(),
        role: resolvedRole,
        force: true,
      });
      return { ok: true, user: profile, needsVerification: false };
    } catch (e) {
      return {
        ok: false,
        error:
          (e?.response?.data?.detail != null
            ? formatApiError(e.response.data.detail)
            : null) || authErrorMessage(e),
      };
    }
  };

  const logout = async () => {
    try {
      if (supabase) await supabase.auth.signOut({ scope: "local" });
    } catch {
      // ignore
    }
    clearToken();
    clearAuthEphemeralState();
    appliedTokenRef.current = null;
    setSession(null);
    setUser(false);
  };

  const forgotPassword = async (email) => {
    if (!supabase) return notConfiguredError();
    try {
      const target = email.trim().toLowerCase();
      if (!target) return { ok: false, error: "Enter your email address." };
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: getAuthRedirectUrl(RESET_PASSWORD_PATH),
      });
      if (error) return { ok: false, error: authErrorMessage(error) };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: authErrorMessage(e) };
    }
  };

  const resetPassword = async (password) => {
    if (!supabase) return notConfiguredError();
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) return { ok: false, error: authErrorMessage(sessionError) };
      if (!sessionData.session) {
        return {
          ok: false,
          error: "Reset link expired or invalid. Request a new password reset email.",
        };
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { ok: false, error: authErrorMessage(error) };
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }
      clearToken();
      clearAuthEphemeralState();
      appliedTokenRef.current = null;
      setSession(null);
      setUser(false);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: authErrorMessage(e) };
    }
  };

  const resendVerificationEmail = async (email) => {
    if (!supabase) return notConfiguredError();
    const target = (email || getPendingVerifyEmail() || "").trim().toLowerCase();
    if (!target) {
      return { ok: false, error: "Enter your email address to resend the verification link." };
    }
    try {
      setPendingVerifyEmail(target);
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: target,
        options: {
          emailRedirectTo: getAuthRedirectUrl(AUTH_CALLBACK_PATH),
        },
      });
      if (error) return { ok: false, error: authErrorMessage(error) };
      return { ok: true, message: "Verification email sent. Check your inbox." };
    } catch (e) {
      return { ok: false, error: authErrorMessage(e) };
    }
  };

  const loginWithGoogle = async (role) => {
    if (!supabase) return notConfiguredError();
    try {
      // Only set pending role on signup; login should not force student
      if (role === "student" || role === "client") {
        setPendingRole(resolveAuthRole(role));
      } else {
        clearPendingRole();
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthRedirectUrl(AUTH_CALLBACK_PATH),
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (error) {
        const msg = authErrorMessage(error);
        if (/provider is not enabled|unsupported provider/i.test(msg)) {
          return {
            ok: false,
            error:
              "Google sign-in is not enabled yet. Ask an admin to enable the Google provider in Supabase Authentication.",
          };
        }
        return { ok: false, error: msg };
      }
      return { ok: true, redirecting: true };
    } catch (e) {
      return { ok: false, error: authErrorMessage(e) };
    }
  };

  /** Completes OAuth / email-confirm redirects on /auth/callback */
  const handleAuthCallback = useCallback(async () => {
    if (!supabase) return notConfiguredError();
    try {
      const { session: nextSession, error } = await completeAuthRedirect(supabase);
      if (error || !nextSession) {
        return { ok: false, error: error || "No session found. Try signing in again." };
      }
      const profile = await applySession(nextSession, { force: true });
      if (profile?.suspended) {
        return { ok: false, error: "This account has been suspended. Contact support." };
      }
      if (!profile) {
        return { ok: false, error: "Could not restore your account. Please sign in." };
      }
      return { ok: true, user: profile };
    } catch (e) {
      return {
        ok: false,
        error:
          (e?.response?.data?.detail != null
            ? formatApiError(e.response.data.detail)
            : null) || authErrorMessage(e),
      };
    }
  }, [applySession]);

  /** Establish recovery session on /reset-password (PKCE code or hash tokens). */
  const establishRecoverySession = useCallback(async () => {
    if (!supabase) return notConfiguredError();
    try {
      const { session: nextSession, error } = await completeAuthRedirect(supabase);
      if (error || !nextSession) {
        return {
          ok: false,
          error: error || "Reset link expired or invalid. Request a new password reset email.",
        };
      }
      saveTokens(nextSession.access_token, nextSession.refresh_token);
      setSession(nextSession);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: authErrorMessage(e) };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isSupabaseConfigured,
        login,
        register,
        logout,
        refresh,
        setUser,
        forgotPassword,
        resetPassword,
        resendVerificationEmail,
        loginWithGoogle,
        handleAuthCallback,
        establishRecoverySession,
        getPendingVerifyEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

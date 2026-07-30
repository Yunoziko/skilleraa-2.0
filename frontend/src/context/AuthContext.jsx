import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import api, { saveTokens, clearToken, formatApiError } from "@/lib/api";
import {
  supabase,
  isSupabaseConfigured,
  getAuthRedirectUrl,
  setPendingRole,
  consumePendingRole,
  setPendingVerifyEmail,
  getPendingVerifyEmail,
  clearPendingVerifyEmail,
  clearAuthEphemeralState,
  AUTH_CALLBACK_PATH,
  RESET_PASSWORD_PATH,
} from "@/lib/supabase";

const AuthContext = createContext(null);

function authErrorMessage(error) {
  if (!error) return "Something went wrong. Please try again.";
  if (typeof error === "string") return error;
  return error.message || "Something went wrong. Please try again.";
}

function notConfiguredError() {
  return {
    ok: false,
    error:
      "Supabase is not configured. Replace PLACEHOLDER values in frontend/.env and restart the app.",
  };
}

async function syncProfile({ name, role } = {}) {
  const body = {};
  if (name) body.name = name;
  if (role === "student" || role === "client") body.role = role;
  const { data } = await api.post("/auth/sync", body);
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const syncedAccessTokenRef = useRef(null);
  const syncInFlightRef = useRef(null);

  const applySession = useCallback(async (nextSession, { name, role, force = false } = {}) => {
    if (!nextSession?.access_token) {
      clearToken();
      syncedAccessTokenRef.current = null;
      setSession(null);
      setUser(false);
      return null;
    }

    saveTokens(nextSession.access_token, nextSession.refresh_token);
    setSession(nextSession);

    // Skip duplicate profile sync for the same access token (login + onAuthStateChange race)
    if (!force && !name && !role && syncedAccessTokenRef.current === nextSession.access_token) {
      return undefined;
    }

    if (syncInFlightRef.current) {
      return syncInFlightRef.current;
    }

    const pendingRole = role || consumePendingRole(null);
    const work = (async () => {
      try {
        const profile = await syncProfile({
          name,
          role: pendingRole || undefined,
        });
        syncedAccessTokenRef.current = nextSession.access_token;
        clearPendingVerifyEmail();
        setUser(profile);
        return profile;
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          clearToken();
          syncedAccessTokenRef.current = null;
          setSession(null);
          setUser(false);
        } else {
          // Network / backend down — keep Supabase session tokens, mark unauthenticated for routes
          setUser(false);
        }
        throw e;
      } finally {
        if (syncInFlightRef.current === work) {
          syncInFlightRef.current = null;
        }
      }
    })();

    syncInFlightRef.current = work;
    return work;
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
        syncedAccessTokenRef.current = null;
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
        syncedAccessTokenRef.current = null;
        setSession(null);
        setUser(false);
        return;
      }

      if (event === "TOKEN_REFRESHED" && nextSession) {
        saveTokens(nextSession.access_token, nextSession.refresh_token);
        setSession(nextSession);
        return;
      }

      // Recovery session is owned by ResetPassword — keep tokens, do not sync profile yet
      if (event === "PASSWORD_RECOVERY" && nextSession) {
        saveTokens(nextSession.access_token, nextSession.refresh_token);
        setSession(nextSession);
        return;
      }

      if (nextSession) {
        saveTokens(nextSession.access_token, nextSession.refresh_token);
        setSession(nextSession);
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          try {
            await applySession(nextSession);
          } catch {
            // callers surface errors; boot refresh retries via ProtectedRoute unauth
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
        await supabase.auth.signOut();
        setPendingVerifyEmail(normalized);
        return {
          ok: false,
          error: "Please verify your email before logging in. Check your inbox for the confirmation link.",
          needsVerification: true,
        };
      }
      const profile = await applySession(data.session, { force: true });
      return { ok: true, user: profile };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || authErrorMessage(e) };
    }
  };

  const register = async ({ email, password, name, role = "student" }) => {
    if (!supabase) return notConfiguredError();
    try {
      const normalized = email.trim().toLowerCase();
      setPendingRole(role);
      setPendingVerifyEmail(normalized);
      const { data, error } = await supabase.auth.signUp({
        email: normalized,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(AUTH_CALLBACK_PATH),
          data: {
            name: name?.trim() || "",
            intended_role: role,
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

      const profile = await applySession(data.session, { name, role, force: true });
      return { ok: true, user: profile, needsVerification: false };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || authErrorMessage(e) };
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
    syncedAccessTokenRef.current = null;
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
      // Force a clean login with the new password
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // ignore
      }
      clearToken();
      clearAuthEphemeralState();
      syncedAccessTokenRef.current = null;
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

  const loginWithGoogle = async (role = "student") => {
    if (!supabase) return notConfiguredError();
    try {
      setPendingRole(role);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getAuthRedirectUrl(AUTH_CALLBACK_PATH),
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });
      if (error) return { ok: false, error: authErrorMessage(error) };
      return { ok: true, redirecting: true };
    } catch (e) {
      return { ok: false, error: authErrorMessage(e) };
    }
  };

  /** Completes OAuth / email-confirm redirects on /auth/callback */
  const handleAuthCallback = useCallback(async () => {
    if (!supabase) return notConfiguredError();
    try {
      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error") || params.get("error_code");
      if (oauthError) {
        return {
          ok: false,
          error: params.get("error_description") || oauthError || "Authentication failed",
        };
      }

      const code = params.get("code");
      if (code) {
        const { data: exchanged, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) return { ok: false, error: authErrorMessage(exchangeError) };
        if (exchanged?.session) {
          const profile = await applySession(exchanged.session, { force: true });
          return { ok: true, user: profile };
        }
      }

      // Hash-based redirects (email confirm / older flows)
      let { data, error } = await supabase.auth.getSession();
      if (error) return { ok: false, error: authErrorMessage(error) };
      if (!data.session) {
        await new Promise((r) => setTimeout(r, 300));
        ({ data, error } = await supabase.auth.getSession());
        if (error) return { ok: false, error: authErrorMessage(error) };
      }
      if (!data.session) {
        return { ok: false, error: "No session found. Try signing in again." };
      }
      const profile = await applySession(data.session, { force: true });
      return { ok: true, user: profile };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || authErrorMessage(e) };
    }
  }, [applySession]);

  /** Establish recovery session on /reset-password (PKCE code or hash tokens). */
  const establishRecoverySession = useCallback(async () => {
    if (!supabase) return notConfiguredError();
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) return { ok: false, error: authErrorMessage(error) };
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) return { ok: false, error: authErrorMessage(error) };
      if (!data.session) {
        return {
          ok: false,
          error: "Reset link expired or invalid. Request a new password reset email.",
        };
      }
      saveTokens(data.session.access_token, data.session.refresh_token);
      setSession(data.session);
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

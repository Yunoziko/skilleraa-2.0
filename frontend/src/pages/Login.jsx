import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { safePostLoginPath } from "@/components/layout/ProtectedRoute";
import { getPendingVerifyEmail } from "@/lib/supabase";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const { login, loginWithGoogle, resendVerificationEmail, user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);

  useEffect(() => {
    const pending = getPendingVerifyEmail();
    if (pending && !email) setEmail(pending);
  }, [email]);

  useEffect(() => {
    if (!authLoading && user && user !== false) {
      nav(safePostLoginPath(location.state?.from, user.role), { replace: true });
    }
  }, [authLoading, user, nav, location.state?.from]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      setNeedsVerification(Boolean(res.needsVerification));
      return;
    }
    toast.success(`Welcome back, ${res.user.name}`);
    const dest = safePostLoginPath(location.state?.from, res.user.role);
    nav(dest);
  };

  const onResend = async () => {
    setLoading(true);
    const res = await resendVerificationEmail(email);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(res.message || "Verification email sent");
  };

  const onGoogle = async () => {
    setError("");
    setLoading(true);
    // Do not force a role on login — preserve existing profiles.role
    const res = await loginWithGoogle();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
    }
  };

  const applyDemo = (role) => {
    if (role === "student") {
      setEmail("student@skilleraa.com");
      setPassword("Student@1234");
    } else {
      setEmail("client@skilleraa.com");
      setPassword("Client@1234");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col justify-between p-8 lg:p-14 border-r skl-border"
      >
        <Link to="/" className="flex items-center gap-2" data-testid="auth-logo">
          <div className="h-7 w-7 rounded-lg bg-black text-white grid place-items-center font-display font-bold text-sm">
            S
          </div>
          <span className="font-display font-semibold tracking-tight text-[17px]">Skilleraa</span>
        </Link>

        <div className="max-w-md mx-auto w-full py-14">
          <h1 className="font-display text-4xl md:text-5xl tracking-tighter font-medium">Welcome back.</h1>
          <p className="mt-3 text-neutral-600">Log in to continue applying and hiring.</p>

          <form onSubmit={submit} className="mt-10 space-y-5" data-testid="login-form">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
                placeholder="you@work.com"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Password</label>
                <Link to="/forgot-password" className="text-xs text-neutral-500 hover:text-black" data-testid="login-forgot-link">Forgot?</Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
                placeholder="••••••••"
                data-testid="login-password-input"
              />
            </div>

            {error && (
              <div className="text-sm text-black bg-neutral-100 border skl-border rounded-lg px-3 py-2" data-testid="login-error">
                {error}
                {needsVerification && (
                  <button
                    type="button"
                    onClick={onResend}
                    disabled={loading}
                    className="mt-2 block text-sm font-medium underline underline-offset-4 disabled:opacity-60"
                    data-testid="login-resend-verification"
                  >
                    Resend verification email
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white rounded-full py-3 text-sm font-medium hover:bg-black/90 active:scale-[0.98] transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
              data-testid="login-submit-btn"
            >
              {loading ? "Signing in…" : "Log in"} <ArrowRight size={14} />
            </button>
          </form>

          <button
            type="button"
            onClick={onGoogle}
            disabled={loading}
            className="mt-4 w-full text-sm border skl-border rounded-full py-3 hover:bg-neutral-50 transition disabled:opacity-60"
            data-testid="login-google-btn"
          >
            Continue with Google
          </button>

          <div className="mt-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => applyDemo("student")}
              className="flex-1 text-xs border skl-border rounded-full py-2 hover:bg-neutral-50 transition"
              data-testid="login-demo-student"
            >
              Demo student
            </button>
            <button
              type="button"
              onClick={() => applyDemo("client")}
              className="flex-1 text-xs border skl-border rounded-full py-2 hover:bg-neutral-50 transition"
              data-testid="login-demo-client"
            >
              Demo client
            </button>
          </div>

          <div className="mt-8 text-sm text-neutral-600">
            Don't have an account?{" "}
            <Link to="/signup" className="text-black font-medium underline underline-offset-4">
              Sign up
            </Link>
          </div>
        </div>

        <div className="text-xs text-neutral-500 font-mono">© {new Date().getFullYear()} Skilleraa</div>
      </motion.div>

      <div className="hidden lg:flex bg-black text-white p-14 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }} aria-hidden />
        <div className="text-xs uppercase tracking-[0.24em] text-neutral-400 font-semibold relative">Skilleraa</div>
        <div className="relative">
          <blockquote className="font-display text-3xl leading-tight tracking-tight">
            “The cleanest freelancing marketplace I've used. Feels like Linear for careers.”
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white text-black grid place-items-center font-display font-semibold">
              A
            </div>
            <div>
              <div className="text-sm font-medium">Aarav Sharma</div>
              <div className="text-xs text-neutral-400">Student · Bengaluru</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { ArrowRight, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const { resetPassword, establishRecoverySession } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      if (!supabase) {
        if (active) {
          setError("Supabase is not configured. Replace PLACEHOLDER values in frontend/.env and restart the app.");
          setReady(true);
        }
        return;
      }

      const res = await establishRecoverySession();
      if (!active) return;
      if (!res.ok) {
        setError(res.error);
        setReady(true);
        return;
      }
      setReady(true);
    })();

    const { data: sub } = supabase
      ? supabase.auth.onAuthStateChange((event) => {
          if (!active) return;
          if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
            setError("");
            setReady(true);
          }
        })
      : { data: { subscription: { unsubscribe() {} } } };

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [establishRecoverySession]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const res = await resetPassword(password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Password updated. Please log in.");
    nav("/login");
  };

  return (
    <div className="min-h-screen bg-white grid place-items-center px-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-10 justify-center">
          <div className="h-8 w-8 rounded-lg bg-black text-white grid place-items-center font-display font-bold">S</div>
          <span className="font-display font-semibold tracking-tight text-lg">Skilleraa</span>
        </Link>

        <div className="border skl-border rounded-2xl p-8">
          <div className="h-10 w-10 rounded-xl border skl-border grid place-items-center mb-5">
            <KeyRound size={16} />
          </div>
          <h1 className="font-display text-3xl tracking-tighter font-medium">Set a new password</h1>
          <p className="mt-2 text-neutral-600 text-sm">Choose a strong password. Minimum 6 characters.</p>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="reset-form">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">New password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
                placeholder="••••••••"
                data-testid="reset-password-input"
                disabled={!ready}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
                placeholder="••••••••"
                data-testid="reset-confirm-input"
                disabled={!ready}
              />
            </div>

            {error && (
              <div className="text-sm bg-neutral-100 border skl-border rounded-lg px-3 py-2" data-testid="reset-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !ready}
              className="w-full bg-black text-white rounded-full py-3 text-sm font-medium hover:bg-black/90 active:scale-[0.98] transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
              data-testid="reset-submit-btn"
            >
              {loading ? "Updating…" : "Update password"} <ArrowRight size={14} />
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-neutral-600 hover:text-black">
                ← Back to login
              </Link>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import api, { formatApiError } from "@/lib/api";
import { ArrowRight, Mail } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSent(true);
      if (data.dev_token) setDevToken(data.dev_token);
      toast.success("Check your inbox for the reset link");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
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
            <Mail size={16} />
          </div>
          <h1 className="font-display text-3xl tracking-tighter font-medium">Reset your password</h1>
          <p className="mt-2 text-neutral-600 text-sm">
            Enter your email and we'll send you a reset link.
          </p>

          {sent ? (
            <div className="mt-6 space-y-4">
              <div className="border skl-border rounded-xl p-4 bg-neutral-50" data-testid="forgot-success">
                <div className="text-sm font-medium">Reset link sent</div>
                <p className="text-xs text-neutral-600 mt-1">
                  If an account exists for <span className="font-mono">{email}</span>, you'll receive an email shortly.
                </p>
              </div>

              {devToken && (
                <div className="border skl-border rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold">
                    Dev shortcut
                  </div>
                  <p className="text-xs text-neutral-600 mt-2">
                    In production, this link goes via email. For this demo:
                  </p>
                  <Link
                    to={`/reset-password?token=${devToken}`}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
                    data-testid="forgot-dev-link"
                  >
                    Open reset page <ArrowRight size={14} />
                  </Link>
                </div>
              )}

              <Link
                to="/login"
                className="inline-block mt-2 text-sm text-neutral-600 hover:text-black"
              >
                ← Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4" data-testid="forgot-form">
              <div>
                <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
                  placeholder="you@work.com"
                  data-testid="forgot-email-input"
                />
              </div>

              {error && (
                <div className="text-sm bg-neutral-100 border skl-border rounded-lg px-3 py-2" data-testid="forgot-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white rounded-full py-3 text-sm font-medium hover:bg-black/90 active:scale-[0.98] transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
                data-testid="forgot-submit-btn"
              >
                {loading ? "Sending…" : "Send reset link"} <ArrowRight size={14} />
              </button>

              <div className="text-center">
                <Link to="/login" className="text-sm text-neutral-600 hover:text-black">
                  ← Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}

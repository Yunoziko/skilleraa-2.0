import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, GraduationCap, Briefcase } from "lucide-react";

export default function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await register({ ...form, role });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success(`Welcome to Skilleraa, ${res.user.name}`);
    nav(role === "client" ? "/client" : "/student");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex bg-black text-white p-14 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }} aria-hidden />
        <div className="text-xs uppercase tracking-[0.24em] text-neutral-400 font-semibold relative">Join Skilleraa</div>
        <div className="relative space-y-6">
          <h2 className="font-display text-4xl leading-tight tracking-tighter">
            Real work.<br /> Real experience.<br /> Zero fluff.
          </h2>
          <ul className="space-y-3 text-sm text-neutral-300">
            <li>· Free to join. Free forever for students.</li>
            <li>· Verified clients only.</li>
            <li>· Minimal, distraction-free interface.</li>
          </ul>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col justify-between p-8 lg:p-14"
      >
        <Link to="/" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-black text-white grid place-items-center font-display font-bold text-sm">
            S
          </div>
          <span className="font-display font-semibold tracking-tight text-[17px]">Skilleraa</span>
        </Link>

        <div className="max-w-md mx-auto w-full py-14">
          <h1 className="font-display text-4xl md:text-5xl tracking-tighter font-medium">Create your account.</h1>
          <p className="mt-3 text-neutral-600">In under 60 seconds.</p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole("student")}
              data-testid="signup-role-student"
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border transition ${
                role === "student" ? "border-black bg-neutral-50" : "skl-border hover:bg-neutral-50"
              }`}
            >
              <GraduationCap size={18} />
              <div>
                <div className="text-sm font-semibold">I'm a Student</div>
                <div className="text-xs text-neutral-500">Find work, build experience</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRole("client")}
              data-testid="signup-role-client"
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border transition ${
                role === "client" ? "border-black bg-neutral-50" : "skl-border hover:bg-neutral-50"
              }`}
            >
              <Briefcase size={18} />
              <div>
                <div className="text-sm font-semibold">I'm a Client</div>
                <div className="text-xs text-neutral-500">Post jobs, hire talent</div>
              </div>
            </button>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-5" data-testid="signup-form">
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Full Name</label>
              <input
                required
                minLength={2}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
                placeholder="Your name"
                data-testid="signup-name-input"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
                placeholder="you@work.com"
                data-testid="signup-email-input"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="mt-2 w-full border skl-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-black transition"
                placeholder="At least 6 characters"
                data-testid="signup-password-input"
              />
            </div>

            {error && (
              <div className="text-sm text-black bg-neutral-100 border skl-border rounded-lg px-3 py-2" data-testid="signup-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white rounded-full py-3 text-sm font-medium hover:bg-black/90 active:scale-[0.98] transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
              data-testid="signup-submit-btn"
            >
              {loading ? "Creating…" : "Create account"} <ArrowRight size={14} />
            </button>
          </form>

          <div className="mt-8 text-sm text-neutral-600">
            Already have an account?{" "}
            <Link to="/login" className="text-black font-medium underline underline-offset-4">
              Log in
            </Link>
          </div>
        </div>

        <div className="text-xs text-neutral-500 font-mono">© {new Date().getFullYear()} Skilleraa</div>
      </motion.div>
    </div>
  );
}

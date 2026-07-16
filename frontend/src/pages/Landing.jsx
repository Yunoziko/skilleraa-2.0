import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Check,
  Sparkles,
  ShieldCheck,
  Users,
  Zap,
  GraduationCap,
  Wand2,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import DashboardMockup from "@/components/DashboardMockup";
import JobCard from "@/components/JobCard";
import api from "@/lib/api";

const features = [
  { icon: ShieldCheck, title: "Verified Clients", desc: "Every client is manually reviewed before their first post." },
  { icon: Zap, title: "Easy Applications", desc: "One-click apply with your Skilleraa profile. No endless forms." },
  { icon: GraduationCap, title: "Student Friendly", desc: "Beginner-tier jobs, mentorship prompts, portfolio nudges." },
  { icon: Wand2, title: "AI Job Matching", desc: "Get matched to work that fits your skills.", badge: "Soon" },
  { icon: ShieldCheck, title: "Secure Hiring", desc: "Milestone-based safety. Both sides are protected end-to-end." },
  { icon: Sparkles, title: "Fast Profile Setup", desc: "Ready in under 3 minutes. Import from LinkedIn or GitHub." },
];

const trustedLogos = ["Northwind", "Lumen", "Parallax", "Vantage", "Meridian", "Ostara", "Corvid", "Halcyon"];

const testimonials = [
  {
    quote: "Skilleraa gave me my first paid design gig. The interface is so clean I actually enjoy checking it every morning.",
    name: "Aarav Sharma",
    role: "Student · Bengaluru",
  },
  {
    quote: "We hired two freshers within a week. Both are still on our team. The quality of applicants is stunning.",
    name: "Priya Mehta",
    role: "Founder, Northwind Labs",
  },
  {
    quote: "Every other platform is a fee-heavy mess. Skilleraa is minimal, transparent, and it just works.",
    name: "Rohan Kapoor",
    role: "Founder, Lumen Studio",
  },
];

export default function Landing() {
  const [featured, setFeatured] = useState([]);
  const [stats, setStats] = useState({ students: 0, clients: 0, jobs: 0, success_rate: 95 });

  useEffect(() => {
    api.get("/jobs/featured").then((r) => setFeatured(r.data)).catch(() => {});
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 dotgrid opacity-40 pointer-events-none" aria-hidden />
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-24 lg:pt-24 lg:pb-32 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 border skl-border rounded-full px-3 py-1 text-xs font-medium"
              data-testid="hero-badge"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-black inline-block" />
              Beta live · No fees for the first 500 students
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-6 font-display text-5xl md:text-6xl lg:text-[76px] leading-[1.02] tracking-tighter font-medium"
              data-testid="hero-headline"
            >
              Find real freelance work.<br />
              Build experience.<br />
              <span className="italic font-normal">Earn money.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 text-neutral-600 text-lg leading-relaxed max-w-xl"
            >
              Skilleraa connects students, freshers and beginner professionals with startups, agencies and businesses — in a minimal, distraction-free interface.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-black/90 active:scale-95 transition"
                data-testid="hero-get-started-btn"
              >
                Get Started <ArrowRight size={16} />
              </Link>
              <Link
                to="/jobs"
                className="inline-flex items-center gap-2 border skl-border px-6 py-3 rounded-full text-sm font-medium hover:bg-neutral-50 transition"
                data-testid="hero-browse-jobs-btn"
              >
                Browse Jobs
              </Link>
            </motion.div>

            <div className="mt-10 flex items-center gap-6 text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                <Check size={14} className="text-black" /> Free forever for students
              </div>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-black" /> No commission
              </div>
            </div>
          </div>

          <div className="lg:pl-6">
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* TRUSTED BY */}
      <section className="border-y skl-border bg-white py-10" data-testid="trusted-by-section">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold text-center">
            Trusted by fast-moving teams
          </div>
          <div className="mt-6 overflow-hidden">
            <div className="flex gap-14 marquee items-center whitespace-nowrap">
              {[...trustedLogos, ...trustedLogos].map((logo, i) => (
                <div
                  key={i}
                  className="text-2xl font-display font-medium tracking-tight text-neutral-400 hover:text-black transition"
                >
                  {logo}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold">Why Skilleraa</div>
            <h2 className="mt-3 font-display text-4xl md:text-5xl tracking-tighter font-medium">
              Built for beginners.<br /> Loved by startups.
            </h2>
          </div>
          <p className="text-neutral-600 max-w-md">
            A platform designed with the same care as the tools you love — Linear, Notion, Vercel.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.05 }}
              className="relative border skl-border rounded-2xl p-8 hover:bg-neutral-50 transition"
              data-testid={`feature-card-${i}`}
            >
              <div className="h-10 w-10 rounded-xl border skl-border grid place-items-center mb-6">
                <f.icon size={16} />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                {f.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black text-white uppercase tracking-widest">
                    {f.badge}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t skl-border bg-neutral-50/50">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
          <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold">How it works</div>
          <h2 className="mt-3 font-display text-4xl md:text-5xl tracking-tighter font-medium max-w-2xl">
            Two paths. One minimal platform.
          </h2>

          <div className="mt-14 grid md:grid-cols-2 gap-6">
            <FlowColumn
              title="Students"
              steps={["Create Account", "Complete Profile", "Browse Jobs", "Apply", "Get Hired"]}
            />
            <FlowColumn
              title="Clients"
              steps={["Create Company", "Post a Job", "Receive Applications", "Interview", "Hire Talent"]}
            />
          </div>
        </div>
      </section>

      {/* FEATURED JOBS */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold">Featured</div>
            <h2 className="mt-3 font-display text-4xl md:text-5xl tracking-tighter font-medium">
              Freshly posted jobs
            </h2>
          </div>
          <Link
            to="/jobs"
            className="hidden md:inline-flex items-center gap-1 text-sm font-medium hover:gap-2 transition-all"
            data-testid="featured-see-all"
          >
            See all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featured.slice(0, 6).map((j, i) => (
            <JobCard key={j.id} job={j} index={i} />
          ))}
        </div>
      </section>

      {/* STATS */}
      <section className="border-y skl-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            [stats.students >= 10 ? `${stats.students}+` : "10K+", "Students"],
            [stats.clients >= 10 ? `${stats.clients}+` : "2K+", "Clients"],
            [stats.jobs >= 10 ? `${stats.jobs}+` : "5K+", "Jobs Posted"],
            [`${stats.success_rate}%`, "Success Rate"],
          ].map(([v, l]) => (
            <div key={l} className="border-l skl-border pl-6">
              <div className="font-display text-5xl md:text-6xl tracking-tighter font-medium">{v}</div>
              <div className="mt-2 text-sm text-neutral-500 uppercase tracking-[0.18em] font-semibold">
                {l}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <div className="text-xs uppercase tracking-[0.24em] text-neutral-500 font-semibold">Testimonials</div>
        <h2 className="mt-3 font-display text-4xl md:text-5xl tracking-tighter font-medium max-w-2xl">
          Words from students and founders.
        </h2>

        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="border skl-border rounded-2xl p-8 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition"
              data-testid={`testimonial-${i}`}
            >
              <blockquote className="font-display text-[18px] leading-relaxed">“{t.quote}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t skl-border pt-5">
                <div className="h-9 w-9 rounded-full bg-black text-white grid place-items-center font-display font-semibold">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-neutral-500">{t.role}</div>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-24">
        <div className="rounded-3xl bg-black text-white p-12 md:p-20 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.05]" style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }} aria-hidden />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-4xl md:text-6xl tracking-tighter font-medium">
              Ready to earn your first ₹?
            </h2>
            <p className="mt-5 text-neutral-300 leading-relaxed">
              Join thousands of students who are already building real experience on Skilleraa.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full text-sm font-medium hover:bg-white/90 active:scale-95 transition"
                data-testid="cta-signup-btn"
              >
                Create free account <ArrowRight size={16} />
              </Link>
              <Link
                to="/jobs"
                className="inline-flex items-center gap-2 border border-white/20 px-6 py-3 rounded-full text-sm font-medium hover:bg-white/10 transition"
                data-testid="cta-browse-jobs-btn"
              >
                Browse Jobs
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FlowColumn({ title, steps }) {
  return (
    <div className="bg-white border skl-border rounded-2xl p-8">
      <div className="flex items-center justify-between">
        <div className="font-display text-2xl font-semibold">{title}</div>
        <Users size={16} className="text-neutral-400" />
      </div>
      <div className="mt-6 space-y-3">
        {steps.map((s, i) => (
          <div key={s}>
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl border skl-border">
              <div className="h-6 w-6 rounded-full bg-black text-white grid place-items-center text-[11px] font-mono">
                {i + 1}
              </div>
              <div className="text-sm font-medium">{s}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex justify-center py-1 text-neutral-300">
                <ArrowDown size={14} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

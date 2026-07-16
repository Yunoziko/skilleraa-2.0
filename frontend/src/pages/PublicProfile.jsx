import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import api from "@/lib/api";
import { ExternalLink } from "lucide-react";

export default function PublicProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    api.get(`/profile/${id}`).then((r) => {
      setProfile(r.data);
      if (r.data.role === "client") {
        api.get("/jobs").then((jr) => {
          setJobs(jr.data.filter((j) => j.client_id === id));
        });
      }
    }).catch(() => {});
  }, [id]);

  if (!profile) return (
    <div className="min-h-screen bg-white grid place-items-center">
      <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />
      <section className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="h-20 w-20 rounded-2xl bg-black text-white grid place-items-center font-display font-semibold text-3xl">
            {profile.avatar_letter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">{profile.role}</div>
            <h1 className="mt-1 font-display text-4xl md:text-5xl tracking-tighter font-medium">
              {profile.role === "client" ? profile.company_name || profile.name : profile.name}
            </h1>
            {profile.headline && <p className="mt-2 text-neutral-700">{profile.headline}</p>}
            {profile.company_website && (
              <a href={profile.company_website} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-black">
                {profile.company_website} <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        {profile.bio && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">About</div>
            <p className="mt-3 leading-relaxed text-neutral-700 whitespace-pre-line">{profile.bio}</p>
          </div>
        )}

        {profile.company_description && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">About the company</div>
            <p className="mt-3 leading-relaxed text-neutral-700 whitespace-pre-line">{profile.company_description}</p>
          </div>
        )}

        {profile.skills?.length > 0 && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Skills</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <span key={s} className="text-xs px-3 py-1.5 rounded-full border skl-border">{s}</span>
              ))}
            </div>
          </div>
        )}

        {profile.education && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Education</div>
            <p className="mt-3 text-neutral-700">{profile.education}</p>
          </div>
        )}

        {profile.portfolio_url && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Portfolio</div>
            <a href={profile.portfolio_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-neutral-700 hover:text-black underline underline-offset-4">
              {profile.portfolio_url} <ExternalLink size={12} />
            </a>
          </div>
        )}

        {profile.role === "client" && jobs.length > 0 && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Open jobs</div>
            <div className="mt-4 space-y-2">
              {jobs.map((j) => (
                <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center justify-between p-3 border skl-border rounded-xl hover:bg-neutral-50">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{j.title}</div>
                    <div className="text-xs text-neutral-500">{j.category} · {j.budget}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import { ListRowSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { ExternalLink, FileText, Pencil } from "lucide-react";
import {
  DEMO_STUDENT_PROFILE_ID,
  displayAvailability,
  getMyMockProfile,
  subscribeProfiles,
} from "@/lib/mockProfiles";

export default function StudentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    // Auth paused — always use local mock profile (merge email/name from auth if present)
    const local = getMyMockProfile("student");
    if (user && user !== false) {
      setProfile({
        ...local,
        name: user.name || local.name,
        email: user.email || local.email,
        headline: user.headline || local.headline,
        bio: user.bio || local.bio,
        location: user.location || local.location,
        skills: user.skills?.length ? user.skills : local.skills,
        education: user.education || local.education,
        portfolio_url: user.portfolio_url || local.portfolio_url,
        resume_url: user.resume_url || local.resume_url,
        resume_filename: user.resume_filename || local.resume_filename,
        id: user.id || local.id,
      });
    } else {
      setProfile(local);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    return subscribeProfiles(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !profile) {
    return (
      <DashboardShell title="Your Profile">
        <ListRowSkeleton count={4} />
      </DashboardShell>
    );
  }

  const links = (profile.portfolio_links?.length
    ? profile.portfolio_links
    : profile.portfolio_url
      ? [profile.portfolio_url]
      : []
  ).filter(Boolean);

  return (
    <DashboardShell
      title="Your Profile"
      actions={
        <Link
          to="/student/profile/edit"
          className="inline-flex items-center gap-2 bg-black text-white text-sm px-5 py-2.5 rounded-full hover:bg-black/90"
          data-testid="student-profile-edit-btn"
        >
          <Pencil size={14} /> Edit Profile
        </Link>
      }
    >
      <div className="grid lg:grid-cols-3 gap-6" data-testid="student-profile-view">
        <aside className="lg:col-span-1 space-y-4">
          <div className="border skl-border rounded-2xl p-6">
            <div className="h-24 w-24 rounded-2xl bg-black text-white grid place-items-center font-display font-semibold text-4xl">
              {profile.avatar_letter || "S"}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-neutral-400">Photo placeholder</div>
            <div className="mt-4">
              <div className="font-display text-xl font-semibold">{profile.name}</div>
              <div className="text-sm text-neutral-500">{profile.email}</div>
            </div>
            {profile.headline && (
              <p className="mt-3 text-sm text-neutral-700">{profile.headline}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                Student
              </span>
              <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                {displayAvailability(profile.availability)}
              </span>
            </div>
            {profile.location && (
              <div className="mt-3 text-xs text-neutral-500">{profile.location}</div>
            )}
            <Link
              to={`/u/${profile.id || DEMO_STUDENT_PROFILE_ID}`}
              className="mt-5 inline-flex text-xs underline underline-offset-4 text-neutral-600 hover:text-black"
            >
              View public profile
            </Link>
          </div>
        </aside>

        <div className="lg:col-span-2 space-y-6">
          <Section title="About">
            {profile.bio ? (
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{profile.bio}</p>
            ) : (
              <EmptyHint text="Add a short about section so clients know you." />
            )}
          </Section>

          <Section title="Skills">
            {profile.skills?.length ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((s) => (
                  <span key={s} className="text-xs px-3 py-1.5 rounded-full border skl-border">{s}</span>
                ))}
              </div>
            ) : (
              <EmptyHint text="Add skills to improve job matches." />
            )}
          </Section>

          <Section title="Education">
            {profile.education ? (
              <p className="text-sm text-neutral-700">{profile.education}</p>
            ) : (
              <EmptyHint text="Add your education." />
            )}
          </Section>

          <Section title="Experience">
            {profile.experience ? (
              <p className="text-sm text-neutral-700 whitespace-pre-line leading-relaxed">{profile.experience}</p>
            ) : (
              <EmptyHint text="Add work or project experience." />
            )}
          </Section>

          <Section title="Portfolio links">
            {links.length ? (
              <ul className="space-y-2">
                {links.map((url) => (
                  <li key={url}>
                    <a
                      href={url.startsWith("http") ? url : `https://${url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-neutral-700 hover:text-black underline underline-offset-4"
                    >
                      {url} <ExternalLink size={12} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint text="Add portfolio or GitHub links." />
            )}
          </Section>

          <Section title="Resume">
            <div className="flex items-center gap-3 border skl-border rounded-xl p-4 bg-neutral-50">
              <div className="h-10 w-10 rounded-xl border skl-border bg-white grid place-items-center">
                <FileText size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {profile.resume_filename || "Resume placeholder"}
                </div>
                <div className="text-xs text-neutral-500">
                  {profile.resume_url ? "Uploaded" : "No file uploaded yet — placeholder only while auth is paused"}
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </DashboardShell>
  );
}

function Section({ title, children }) {
  return (
    <div className="border skl-border rounded-2xl p-6">
      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function EmptyHint({ text }) {
  return <p className="text-sm text-neutral-500">{text}</p>;
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import { ListRowSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { ExternalLink, FileText, Pencil } from "lucide-react";
import StarRating from "@/components/StarRating";
import {
  DEMO_STUDENT_PROFILE_ID,
  displayAvailability,
  getMyMockProfile,
  subscribeProfiles,
} from "@/lib/mockProfiles";
import {
  fetchProfileRating,
  fetchReviewsForUser,
  formatReviewDate,
} from "@/lib/reviewsService";
import { fetchProfileFileFields, filenameFromPath } from "@/lib/storageService";

export default function StudentProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ratingMeta, setRatingMeta] = useState({ average_rating: 0, review_count: 0 });
  const [reviews, setReviews] = useState([]);

  const load = async () => {
    setLoading(true);
    const local = getMyMockProfile("student");
    const id = user?.id || local.id;
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
        id,
      });
    } else {
      setProfile(local);
    }
    try {
      if (user?.id) {
        const [meta, list, files] = await Promise.all([
          fetchProfileRating(user.id),
          fetchReviewsForUser(user.id),
          fetchProfileFileFields(user.id),
        ]);
        setRatingMeta(meta);
        setReviews(list.slice(0, 5));
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                resume_url: files.resume_url || prev.resume_url,
                resume_filename:
                  prev.resume_filename || filenameFromPath(files.resume_url) || "",
                portfolio_url: files.portfolio_url || prev.portfolio_url,
              }
            : prev
        );
      }
    } catch {
      setRatingMeta({ average_rating: 0, review_count: 0 });
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      await load();
      if (!active) return;
    };
    run();
    const unsub = subscribeProfiles(() => {
      if (active) load();
    });
    return () => {
      active = false;
      unsub();
    };
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
    : []
  ).filter((u) => typeof u === "string" && /^https?:\/\//i.test(u));
  const portfolioFile =
    profile.portfolio_url && !/^https?:\/\//i.test(profile.portfolio_url)
      ? profile.portfolio_url
      : "";

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
            <div className="mt-5 border-t skl-border pt-4" data-testid="profile-rating-summary">
              <div className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">Average rating</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="font-display text-2xl font-medium">
                  {ratingMeta.review_count ? Number(ratingMeta.average_rating).toFixed(1) : "—"}
                </span>
                <StarRating value={ratingMeta.average_rating} size={14} readOnly />
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                {ratingMeta.review_count} review{ratingMeta.review_count === 1 ? "" : "s"}
              </div>
              <Link to="/student/reviews" className="mt-2 inline-flex text-xs underline underline-offset-4 text-neutral-600 hover:text-black">
                See all reviews
              </Link>
            </div>
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

          <Section title="Portfolio">
            {portfolioFile ? (
              <div className="mb-3 flex items-center gap-3 border skl-border rounded-xl p-4 bg-neutral-50">
                <div className="h-10 w-10 rounded-xl border skl-border bg-white grid place-items-center">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {filenameFromPath(portfolioFile) || "Portfolio file"}
                  </div>
                  <div className="text-xs text-neutral-500">Uploaded file on profile</div>
                </div>
              </div>
            ) : null}
            {links.length ? (
              <ul className="space-y-2">
                {links.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-neutral-700 hover:text-black underline underline-offset-4"
                    >
                      {url} <ExternalLink size={12} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : !portfolioFile ? (
              <EmptyHint text="Add portfolio or GitHub links." />
            ) : null}
          </Section>

          <Section title="Resume">
            <div className="flex items-center gap-3 border skl-border rounded-xl p-4 bg-neutral-50">
              <div className="h-10 w-10 rounded-xl border skl-border bg-white grid place-items-center">
                <FileText size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {profile.resume_filename || filenameFromPath(profile.resume_url) || "No resume"}
                </div>
                <div className="text-xs text-neutral-500">
                  {profile.resume_url ? "Uploaded" : "No file uploaded yet"}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Reviews">
            {reviews.length === 0 ? (
              <EmptyHint text="No reviews yet." />
            ) : (
              <div className="space-y-3" data-testid="profile-reviews-list">
                {reviews.map((r) => (
                  <div key={r.id} className="border skl-border rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{r.reviewer_name}</div>
                      <StarRating value={r.rating} size={12} readOnly />
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">
                      {r.project_name} · {formatReviewDate(r.created_at)}
                    </div>
                    <p className="mt-2 text-sm text-neutral-700 whitespace-pre-line">{r.review}</p>
                  </div>
                ))}
              </div>
            )}
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

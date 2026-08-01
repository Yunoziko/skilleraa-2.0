import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import EmptyState from "@/components/EmptyState";
import JobStatusBadge from "@/components/JobStatusBadge";
import StarRating from "@/components/StarRating";
import { Briefcase, ExternalLink, FileText } from "lucide-react";
import {
  DEMO_CLIENT_PROFILE_ID,
  DEMO_STUDENT_PROFILE_ID,
  displayAvailability,
  getMockProfile,
} from "@/lib/mockProfiles";
import { fetchJobs } from "@/lib/jobsService";
import { getProfile } from "@/lib/profilesService";
import {
  computeRatingStats,
  fetchProfileRating,
  fetchReviewsForUser,
  formatReviewDate,
} from "@/lib/reviewsService";

function ResumePlaceholder({ filename }) {
  return (
    <div
      className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full border skl-border bg-neutral-50"
      data-testid="public-profile-resume"
    >
      <FileText size={14} />
      <span className="text-sm">{filename || "Resume on file"}</span>
    </div>
  );
}

export default function PublicProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [ratingMeta, setRatingMeta] = useState({ average_rating: 0, review_count: 0 });
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setNotFound(false);
    setProfile(null);
    setReviews([]);
    setRatingMeta({ average_rating: 0, review_count: 0 });

    const loadReviews = async (userId) => {
      try {
        const [list, meta] = await Promise.all([
          fetchReviewsForUser(userId),
          fetchProfileRating(userId),
        ]);
        if (!active) return;
        setReviews(list.slice(0, 5));
        setRatingMeta(meta);
      } catch {
        if (!active) return;
        setReviews([]);
      }
    };

    const loadClientJobs = async (clientId) => {
      try {
        const list = await fetchJobs({ status: "open", limit: 50 });
        if (!active) return;
        setJobs(list.filter((j) => String(j.client_id) === String(clientId)));
      } catch {
        if (!active) return;
        setJobs([]);
      }
    };

    getProfile(id)
      .then(async (row) => {
        if (!active) return;
        if (!row) throw new Error("not found");
        setProfile({
          id: row.id,
          role: row.role,
          name: row.full_name,
          company_name: row.full_name,
          avatar_letter: (row.full_name || "U").charAt(0).toUpperCase(),
          avatar_url: row.avatar_url,
          resume_url: row.resume_url,
          portfolio_url: row.portfolio_url,
        });
        if (row.role === "client") {
          await Promise.all([loadClientJobs(row.id), loadReviews(row.id)]);
        } else {
          await loadReviews(row.id);
        }
      })
      .catch(async () => {
        if (!active) return;
        const roleHint =
          id === DEMO_CLIENT_PROFILE_ID || id?.startsWith("mock-client")
            ? "client"
            : "student";
        const mock = getMockProfile(id || DEMO_STUDENT_PROFILE_ID, roleHint);
        if (!mock) {
          setNotFound(true);
          return;
        }
        setProfile(mock);
        if (mock.role === "client") await loadClientJobs(mock.id);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-white text-black">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-20">
          <EmptyState
            title="Profile not found"
            description="This profile is unavailable."
            ctaLabel="Browse Jobs"
            ctaTo="/jobs"
            icon={Briefcase}
          />
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white grid place-items-center">
        <div className="h-6 w-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isClient = profile.role === "client";
  const displayName = isClient ? profile.company_name || profile.name : profile.name;
  const links = (
    profile.portfolio_links?.length
      ? profile.portfolio_links
      : profile.portfolio_url && String(profile.portfolio_url).startsWith("http")
        ? [profile.portfolio_url]
        : []
  ).filter(Boolean);
  const stats = computeRatingStats(reviews);
  const average = ratingMeta.review_count ? ratingMeta.average_rating : stats.average;
  const total = ratingMeta.review_count || stats.total;

  return (
    <div className="min-h-screen bg-white text-black">
      <Navbar />
      <section className="max-w-4xl mx-auto px-6 lg:px-10 py-14">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="h-20 w-20 rounded-2xl bg-black text-white grid place-items-center font-display font-semibold text-3xl">
            {profile.avatar_letter || (displayName || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">{profile.role}</div>
              {!isClient && (
                <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                  {displayAvailability(profile.availability)}
                </span>
              )}
              {isClient && profile.industry && (
                <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                  {profile.industry}
                </span>
              )}
              {isClient && profile.company_size && (
                <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                  {profile.company_size}
                </span>
              )}
            </div>
            <h1 className="mt-1 font-display text-4xl md:text-5xl tracking-tighter font-medium">
              {displayName}
            </h1>
            {profile.headline && <p className="mt-2 text-neutral-700">{profile.headline}</p>}
            {profile.location && <p className="mt-1 text-sm text-neutral-500">{profile.location}</p>}
            {total > 0 && (
              <div className="mt-3 flex items-center gap-3" data-testid="public-rating-summary">
                <StarRating value={average} size={16} readOnly />
                <span className="text-sm font-medium">{Number(average).toFixed(1)}</span>
                <span className="text-sm text-neutral-500">
                  · {total} review{total === 1 ? "" : "s"}
                </span>
              </div>
            )}
            {profile.company_website && (
              <a
                href={profile.company_website.startsWith("http") ? profile.company_website : `https://${profile.company_website}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-black"
              >
                {profile.company_website} <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>

        {(profile.bio || profile.company_description) && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              {isClient ? "About the company" : "About"}
            </div>
            <p className="mt-3 leading-relaxed text-neutral-700 whitespace-pre-line">
              {isClient ? profile.company_description || profile.bio : profile.bio}
            </p>
          </div>
        )}

        {!isClient && profile.skills?.length > 0 && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Skills</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.skills.map((s) => (
                <span key={s} className="text-xs px-3 py-1.5 rounded-full border skl-border">{s}</span>
              ))}
            </div>
          </div>
        )}

        {!isClient && profile.education && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Education</div>
            <p className="mt-3 text-neutral-700">{profile.education}</p>
          </div>
        )}

        {!isClient && profile.experience && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Experience</div>
            <p className="mt-3 text-neutral-700 whitespace-pre-line leading-relaxed">{profile.experience}</p>
          </div>
        )}

        {!isClient && links.length > 0 && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Portfolio</div>
            <ul className="mt-3 space-y-2">
              {links.map((url) => (
                <li key={url}>
                  <a
                    href={url.startsWith("http") ? url : `https://${url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-neutral-700 hover:text-black underline underline-offset-4"
                  >
                    {url} <ExternalLink size={12} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isClient && profile.resume_url && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Resume</div>
            <ResumePlaceholder filename="Resume on file" />
          </div>
        )}

        <div className="mt-10 border-t skl-border pt-8" data-testid="public-recent-reviews">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Recent reviews</div>
            {total > 0 && <div className="text-xs text-neutral-500">{total} total</div>}
          </div>
          <div className="mt-4 space-y-3">
            {reviews.length === 0 ? (
              <p className="text-sm text-neutral-500">No reviews yet.</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="border skl-border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-medium">{r.reviewer_name}</div>
                      <div className="text-xs text-neutral-500">
                        {r.project_name} · {formatReviewDate(r.created_at)}
                      </div>
                    </div>
                    <StarRating value={r.rating} size={14} readOnly />
                  </div>
                  <p className="mt-2 text-sm text-neutral-700 leading-relaxed">{r.review}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {isClient && (
          <div className="mt-10 border-t skl-border pt-8">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Active jobs</div>
            <div className="mt-4 space-y-2">
              {jobs.length === 0 ? (
                <p className="text-sm text-neutral-500">No open jobs right now.</p>
              ) : (
                jobs.map((j) => (
                  <Link
                    key={j.id}
                    to={`/jobs/${j.id}`}
                    className="flex items-center justify-between p-3 border skl-border rounded-xl hover:bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        <span className="truncate">{j.title}</span>
                        <JobStatusBadge status={j.status} />
                      </div>
                      <div className="text-xs text-neutral-500">{j.category} · {j.budget}</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </section>
      <Footer />
    </div>
  );
}

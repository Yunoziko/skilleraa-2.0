import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import JobStatusBadge from "@/components/JobStatusBadge";
import { ListRowSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { Briefcase, ExternalLink, Pencil } from "lucide-react";
import StarRating from "@/components/StarRating";
import {
  DEMO_CLIENT_PROFILE_ID,
  getMyMockProfile,
  subscribeProfiles,
} from "@/lib/mockProfiles";
import { fetchMyJobs } from "@/lib/jobsService";
import { isPubliclyListed } from "@/lib/jobStatus";
import {
  fetchProfileRating,
  fetchReviewsForUser,
  formatReviewDate,
} from "@/lib/reviewsService";

export default function ClientProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratingMeta, setRatingMeta] = useState({ average_rating: 0, review_count: 0 });
  const [reviews, setReviews] = useState([]);

  const load = async () => {
    setLoading(true);
    const local = getMyMockProfile("client");
    if (user && user !== false) {
      setProfile({
        ...local,
        name: user.name || local.name,
        email: user.email || local.email,
        company_name: user.company_name || user.name || local.company_name,
        company_website: user.company_website || local.company_website,
        company_description: user.company_description || local.company_description,
        location: user.location || local.location,
        id: user.id || local.id,
      });
    } else {
      setProfile(local);
    }
    try {
      const list = await fetchMyJobs(user?.id);
      setJobs(list.filter((j) => isPubliclyListed(j.status)).slice(0, 6));
      if (user?.id) {
        const [meta, listReviews] = await Promise.all([
          fetchProfileRating(user.id),
          fetchReviewsForUser(user.id),
        ]);
        setRatingMeta(meta);
        setReviews(listReviews.slice(0, 5));
      }
    } catch {
      setJobs([]);
      setRatingMeta({ average_rating: 0, review_count: 0 });
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsubP = subscribeProfiles(load);
    return () => {
      unsubP();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !profile) {
    return (
      <DashboardShell title="Company Profile">
        <ListRowSkeleton count={4} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Company Profile"
      actions={
        <Link
          to="/client/profile/edit"
          className="inline-flex items-center gap-2 bg-black text-white text-sm px-5 py-2.5 rounded-full hover:bg-black/90"
          data-testid="client-profile-edit-btn"
        >
          <Pencil size={14} /> Edit Profile
        </Link>
      }
    >
      <div className="grid lg:grid-cols-3 gap-6" data-testid="client-profile-view">
        <aside className="lg:col-span-1">
          <div className="border skl-border rounded-2xl p-6">
            <div className="h-24 w-24 rounded-2xl bg-black text-white grid place-items-center font-display font-semibold text-4xl">
              {(profile.company_name || profile.name || "C")[0].toUpperCase()}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-neutral-400">Logo placeholder</div>
            <div className="mt-4">
              <div className="font-display text-xl font-semibold">{profile.company_name}</div>
              <div className="text-sm text-neutral-500">{profile.name}</div>
              <div className="text-xs text-neutral-500 mt-1">{profile.email}</div>
            </div>
            {profile.company_website && (
              <a
                href={profile.company_website.startsWith("http") ? profile.company_website : `https://${profile.company_website}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1 text-sm text-neutral-700 hover:text-black underline underline-offset-4"
              >
                {profile.company_website} <ExternalLink size={12} />
              </a>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.industry && (
                <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                  {profile.industry}
                </span>
              )}
              {profile.company_size && (
                <span className="text-[10px] uppercase tracking-widest font-semibold border skl-border px-2 py-1 rounded-full">
                  {profile.company_size}
                </span>
              )}
            </div>
            {profile.location && (
              <div className="mt-3 text-xs text-neutral-500">{profile.location}</div>
            )}
            <div className="mt-5 border-t skl-border pt-4" data-testid="client-profile-rating-summary">
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
              <Link to="/client/reviews" className="mt-2 inline-flex text-xs underline underline-offset-4 text-neutral-600 hover:text-black">
                See all reviews
              </Link>
            </div>
            <Link
              to={`/u/${profile.id || DEMO_CLIENT_PROFILE_ID}`}
              className="mt-5 inline-flex text-xs underline underline-offset-4 text-neutral-600 hover:text-black"
            >
              View public profile
            </Link>
          </div>
        </aside>

        <div className="lg:col-span-2 space-y-6">
          <div className="border skl-border rounded-2xl p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">About company</div>
            {profile.company_description ? (
              <p className="mt-3 text-sm text-neutral-700 leading-relaxed whitespace-pre-line">
                {profile.company_description}
              </p>
            ) : (
              <p className="mt-3 text-sm text-neutral-500">Add a company description.</p>
            )}
          </div>

          <div className="border skl-border rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Active jobs</div>
              <Link to="/client/jobs" className="text-xs text-neutral-500 hover:text-black">Manage</Link>
            </div>
            <div className="mt-4 space-y-2">
              {jobs.length === 0 ? (
                <EmptyState
                  title="No active jobs"
                  description="Open roles will appear here."
                  ctaLabel="Post a Job"
                  ctaTo="/client/post"
                  icon={Briefcase}
                />
              ) : (
                jobs.map((j) => (
                  <Link
                    key={j.id}
                    to={`/jobs/${j.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border skl-border hover:bg-neutral-50"
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

          <div className="border skl-border rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500 font-semibold">Reviews</div>
              <Link to="/client/reviews" className="text-xs text-neutral-500 hover:text-black">All</Link>
            </div>
            {reviews.length === 0 ? (
              <p className="mt-4 text-sm text-neutral-500">No reviews yet.</p>
            ) : (
              <div className="mt-4 space-y-3" data-testid="client-profile-reviews-list">
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
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

/**
 * Supabase Reviews & Ratings.
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchClientApplications,
  fetchMyApplications,
  isApplicationCompleted,
} from "@/lib/applicationsService";

function assertClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

async function currentUserId() {
  const client = assertClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const uid = data?.user?.id;
  if (!uid) throw new Error("You must be signed in.");
  return uid;
}

export function formatReviewDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function computeRatingStats(reviews) {
  const list = reviews || [];
  const total = list.length;
  if (!total) {
    return {
      average: 0,
      total: 0,
      breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  list.forEach((r) => {
    const rating = Math.min(5, Math.max(1, Number(r.rating) || 0));
    sum += rating;
    breakdown[rating] = (breakdown[rating] || 0) + 1;
  });
  return {
    average: Math.round((sum / total) * 10) / 10,
    total,
    breakdown,
  };
}

function mapReviewRow(row) {
  if (!row) return null;
  const reviewer = row.reviewer || row.profiles_reviewer || null;
  const reviewee = row.reviewee || row.profiles_reviewee || null;
  const app = row.applications || row.application || null;
  const job = app?.jobs || app?.job || null;
  const reviewerName = reviewer?.full_name || "User";
  const revieweeName = reviewee?.full_name || "User";
  return {
    id: row.id,
    application_id: row.application_id,
    reviewer_id: row.reviewer_id,
    reviewee_id: row.reviewee_id,
    rating: Number(row.rating) || 0,
    review: row.review || "",
    comment: row.review || "",
    created_at: row.created_at,
    reviewer_name: reviewerName,
    reviewee_name: revieweeName,
    project_name: job?.title || "Project",
    job_title: job?.title || "Project",
  };
}

const REVIEW_SELECT = `
  id,
  application_id,
  reviewer_id,
  reviewee_id,
  rating,
  review,
  created_at,
  reviewer:profiles!reviews_reviewer_profile_fkey (
    id,
    full_name
  ),
  reviewee:profiles!reviews_reviewee_profile_fkey (
    id,
    full_name
  ),
  applications!reviews_application_id_fkey (
    id,
    jobs!applications_job_id_fkey (
      id,
      title,
      client_id
    )
  )
`;

/** Reviews received by a user (newest first). */
export async function fetchReviewsForUser(userId) {
  if (!userId) return [];
  const client = assertClient();
  const { data, error } = await client
    .from("reviews")
    .select(REVIEW_SELECT)
    .eq("reviewee_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapReviewRow);
}

/** Reviews written by the signed-in user. */
export async function fetchMyWrittenReviews() {
  const uid = await currentUserId();
  const client = assertClient();
  const { data, error } = await client
    .from("reviews")
    .select(REVIEW_SELECT)
    .eq("reviewer_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapReviewRow);
}

export async function fetchProfileRating(userId) {
  if (!userId) return { average_rating: 0, review_count: 0 };
  const client = assertClient();
  const { data, error } = await client
    .from("profiles")
    .select("average_rating, review_count")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    average_rating: Number(data?.average_rating) || 0,
    review_count: Number(data?.review_count) || 0,
  };
}

/**
 * Completed applications the current user can still review.
 */
export async function fetchReviewableApplications() {
  const uid = await currentUserId();
  const client = assertClient();
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.role) throw new Error("Profile not found.");

  const apps =
    profile.role === "client"
      ? await fetchClientApplications()
      : await fetchMyApplications();

  const completed = (apps || []).filter((a) => isApplicationCompleted(a.status));
  if (!completed.length) return [];

  const ids = completed.map((a) => a.id);
  const { data: existing, error } = await client
    .from("reviews")
    .select("id, application_id")
    .eq("reviewer_id", uid)
    .in("application_id", ids);
  if (error) throw error;

  const reviewed = new Set((existing || []).map((r) => r.application_id));

  return completed
    .filter((a) => !reviewed.has(a.id))
    .map((a) => {
      const iAmClient = a.job?.client_id === uid;
      const revieweeId = iAmClient ? a.freelancer_id : a.job?.client_id;
      const revieweeName = iAmClient
        ? a.student?.name || "Freelancer"
        : a.job?.company_name || "Client";
      return {
        application: a,
        application_id: a.id,
        job_title: a.job?.title || "Project",
        reviewee_id: revieweeId,
        reviewee_name: revieweeName,
      };
    })
    .filter((x) => x.reviewee_id);
}

export async function createReview({ applicationId, revieweeId, rating, review }) {
  const uid = await currentUserId();
  const stars = Math.min(5, Math.max(1, Number(rating) || 0));
  const text = String(review || "").trim();
  if (!stars) throw new Error("Rating is required.");
  if (text.length < 10) throw new Error("Review must be at least 10 characters.");
  if (!applicationId || !revieweeId) throw new Error("Missing application.");

  const client = assertClient();
  const { data, error } = await client
    .from("reviews")
    .insert({
      application_id: applicationId,
      reviewer_id: uid,
      reviewee_id: revieweeId,
      rating: stars,
      review: text,
    })
    .select(REVIEW_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("You already reviewed this application.");
    }
    throw error;
  }
  return mapReviewRow(data);
}

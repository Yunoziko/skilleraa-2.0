/**
 * Secure resume / portfolio uploads via backend → Supabase Storage.
 */

import api, { formatApiError } from "@/lib/api";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const RESUME_MAX_BYTES = 10 * 1024 * 1024;
export const PORTFOLIO_MAX_BYTES = 50 * 1024 * 1024;

export const RESUME_ACCEPT = ".pdf,application/pdf";
export const PORTFOLIO_ACCEPT = ".pdf,.zip,.png,.jpg,.jpeg,application/pdf,application/zip,image/png,image/jpeg";

const RESUME_MIME = new Set(["application/pdf"]);
const PORTFOLIO_MIME = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
]);

function extOf(name) {
  if (!name || !name.includes(".")) return "";
  return name.split(".").pop().toLowerCase();
}

export function filenameFromPath(path) {
  if (!path) return "";
  const parts = String(path).split("/");
  return parts[parts.length - 1] || path;
}

export function validateUploadFile(file, kind) {
  if (!file) return "Choose a file to upload.";
  const ext = extOf(file.name);
  if (kind === "resume") {
    if (ext !== "pdf" && file.type !== "application/pdf") {
      return "Resume must be a PDF.";
    }
    if (file.type && !RESUME_MIME.has(file.type) && file.type !== "application/octet-stream") {
      return "Resume must be a PDF.";
    }
    if (file.size > RESUME_MAX_BYTES) return "Resume must be 10 MB or smaller.";
  } else {
    const okExt = ["pdf", "zip", "png", "jpg", "jpeg"].includes(ext);
    if (!okExt) return "Portfolio must be PDF, ZIP, PNG, or JPG.";
    if (file.type && !PORTFOLIO_MIME.has(file.type) && file.type !== "application/octet-stream") {
      return "Portfolio must be PDF, ZIP, PNG, or JPG.";
    }
    if (file.size > PORTFOLIO_MAX_BYTES) return "Portfolio must be 50 MB or smaller.";
  }
  return "";
}

/**
 * Upload file with progress (0–100).
 * @returns {{ path, filename, size, kind }}
 */
export async function uploadProfileFile(file, kind, onProgress) {
  const err = validateUploadFile(file, kind);
  if (err) throw new Error(err);

  const form = new FormData();
  form.append("file", file);

  try {
    const { data } = await api.post(`/storage/upload?kind=${kind}`, form, {
      onUploadProgress: (evt) => {
        if (!onProgress || !evt.total) return;
        onProgress(Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      },
    });
    onProgress?.(100);
    return {
      path: data.path || data.resume_url || data.portfolio_url,
      filename: data.filename || file.name,
      size: data.size,
      kind: data.kind || kind,
    };
  } catch (e) {
    const detail = e?.response?.data?.detail;
    throw new Error(formatApiError(detail || e?.message || "Upload failed"));
  }
}

export async function fetchProfileFileFields(userId) {
  if (!supabase || !isSupabaseConfigured || !userId) {
    return { resume_url: "", portfolio_url: "" };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("resume_url, portfolio_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    resume_url: data?.resume_url || "",
    portfolio_url: data?.portfolio_url || "",
  };
}

export async function getSignedFileUrl(path) {
  if (!path) return null;
  try {
    const { data } = await api.get("/storage/signed-url", { params: { path } });
    return data?.url || null;
  } catch (e) {
    const detail = e?.response?.data?.detail;
    throw new Error(formatApiError(detail || e?.message || "Could not open file"));
  }
}

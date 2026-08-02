import axios from "axios";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API_BASE = `${BACKEND_URL}/api`;

if (!BACKEND_URL) {
  logger.warn("REACT_APP_BACKEND_URL is not set — API calls to FastAPI will fail");
}

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

async function getAccessToken() {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      localStorage.setItem("skl_token", token);
      return token;
    }
  }
  return localStorage.getItem("skl_token");
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingQueue = [];

const enqueue = () =>
  new Promise((resolve, reject) => {
    pendingQueue.push({ resolve, reject });
  });

const flushQueue = (error, token) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest || originalRequest._retry) return Promise.reject(error);

    if (error.response?.status === 401 && supabase) {
      if (isRefreshing) {
        try {
          const token = await enqueue();
          originalRequest.headers.Authorization = `Bearer ${token}`;
          originalRequest._retry = true;
          return api(originalRequest);
        } catch (e) {
          return Promise.reject(e);
        }
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !data.session?.access_token) {
          throw refreshError || new Error("Session refresh failed");
        }
        const token = data.session.access_token;
        localStorage.setItem("skl_token", token);
        if (data.session.refresh_token) {
          localStorage.setItem("skl_refresh", data.session.refresh_token);
        }
        flushQueue(null, token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        clearToken();
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // AuthContext clears user via SIGNED_OUT
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export function saveTokens(access, refresh) {
  if (access) localStorage.setItem("skl_token", access);
  if (refresh) localStorage.setItem("skl_refresh", refresh);
}

export function saveToken(token) {
  if (token) localStorage.setItem("skl_token", token);
}

export function clearToken() {
  localStorage.removeItem("skl_token");
  localStorage.removeItem("skl_refresh");
}

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default api;

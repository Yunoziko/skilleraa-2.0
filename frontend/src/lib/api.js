import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Bearer fallback (some browsers strip 3rd-party cookies)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("skl_token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Refresh flow ---
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

    // Skip refresh for auth endpoints themselves
    const skipRefresh =
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/register") ||
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/forgot-password") ||
      originalRequest.url?.includes("/auth/reset-password");

    if (error.response?.status === 401 && !skipRefresh) {
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
        const refreshToken = localStorage.getItem("skl_refresh");
        const headers = refreshToken ? { Authorization: `Bearer ${refreshToken}` } : {};
        const { data } = await axios.post(
          `${API_BASE}/auth/refresh`,
          {},
          { withCredentials: true, headers },
        );
        if (data.access_token) localStorage.setItem("skl_token", data.access_token);
        if (data.refresh_token) localStorage.setItem("skl_refresh", data.refresh_token);
        flushQueue(null, data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        localStorage.removeItem("skl_token");
        localStorage.removeItem("skl_refresh");
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

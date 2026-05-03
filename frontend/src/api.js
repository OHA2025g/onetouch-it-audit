import axios from "axios";

/** Runtime (Docker/Easypanel): BACKEND_URL on the container; see frontend/docker-entrypoint.sh */
function resolveBackendUrl() {
  const rt =
    typeof window !== "undefined" && window.__APP_CONFIG__ && window.__APP_CONFIG__.BACKEND_URL;
  if (rt && String(rt).trim()) return String(rt).trim();
  return process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
}

/** Matches frontend/.env.example and LOCAL_SETUP.md when env is unset (CRA does not load .env.example). */
const rawBackend = resolveBackendUrl();
export const BACKEND_URL = rawBackend.replace(/\/$/, "");
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.endsWith("/auth/login")) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

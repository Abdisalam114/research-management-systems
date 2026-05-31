/** Dev: empty baseURL + Vite proxy (/api, /uploads). Prod: set VITE_API_URL. */
export function getApiBase() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) return "";
  return "http://localhost:5000";
}

export const API_BASE = getApiBase();

export function apiOrigin() {
  if (API_BASE) return API_BASE.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://127.0.0.1:5000";
}

/** Direct backend origin — use when Vite proxy is unavailable (e.g. backend-only OAI tools). */
export function apiServerOrigin() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  return "http://127.0.0.1:5000";
}

/** Relative OAI path — works through Vite proxy on :5173 when backend is running. */
export function oaiRequestPath(verb, extra = {}) {
  const params = new URLSearchParams({ verb, ...extra });
  return `/api/repository/oai?${params.toString()}`;
}

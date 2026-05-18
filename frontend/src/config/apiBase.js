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
  return "http://localhost:5000";
}

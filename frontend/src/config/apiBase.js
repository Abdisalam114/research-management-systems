/** Dev: empty baseURL + Vite proxy. Prod same-host: empty. Prod split-host: VITE_API_URL. */
export function getApiBase() {
  if (import.meta.env.VITE_API_URL) return String(import.meta.env.VITE_API_URL).replace(/\/$/, "");
  return "";
}

export const API_BASE = getApiBase();

export function apiOrigin() {
  if (API_BASE) return API_BASE.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Direct backend origin — use when Vite proxy is unavailable (e.g. backend-only OAI tools). */
export function apiServerOrigin() {
  if (import.meta.env.VITE_API_URL) return String(import.meta.env.VITE_API_URL).replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Relative OAI path — works through Vite proxy on :5173 when backend is running. */
export function oaiRequestPath(verb, extra = {}) {
  const params = new URLSearchParams({ verb, ...extra });
  return `/api/repository/oai?${params.toString()}`;
}

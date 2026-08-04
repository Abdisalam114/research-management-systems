import axios from "axios";
import { API_BASE } from "../config/apiBase";
import { PROGRAM_TIER_HEADER } from "../constants/programTier";
import { getProgramTier } from "../utils/programTierStorage";
import { getAccessToken, getRefreshToken, setAuthTokens } from "../utils/authStorage";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const tier = getProgramTier();
  if (tier) {
    config.headers = config.headers || {};
    config.headers[PROGRAM_TIER_HEADER] = tier;
  }
  const token = getAccessToken();
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${API_BASE}/api/auth/refresh`, { refreshToken }, { withCredentials: true })
      .then((res) => {
        const refreshed = res.data;
        setAuthTokens({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken || refreshToken,
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("rms:tokens-updated", {
              detail: { accessToken: refreshed.accessToken },
            })
          );
        }
        return refreshed.accessToken;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error?.config;
    if (
      error?.response?.status === 401 &&
      original &&
      !original._retry &&
      !String(original.url || "").includes("/api/auth/refresh")
    ) {
      original._retry = true;
      try {
        const nextToken = await refreshAccessToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${nextToken}`;
        return api(original);
      } catch {
        /* fall through */
      }
    }

    if (
      error?.response?.status === 428 &&
      error?.response?.data?.code === "PROGRAM_TIER_REQUIRED" &&
      typeof window !== "undefined" &&
      !window.location.pathname.includes("/program-tier") &&
      !window.location.pathname.includes("/login")
    ) {
      window.location.assign("/program-tier");
    }
    return Promise.reject(error);
  }
);

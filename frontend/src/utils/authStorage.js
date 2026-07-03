const ACCESS_KEY = "just_rms_access_token";
const REFRESH_KEY = "just_rms_refresh_token";
const LEGACY_ACCESS_KEY = "just_rms_access_token";
const LEGACY_TIER_KEY = "just_rms_program_tier";

/** Tab-scoped auth storage so two users can stay logged in side-by-side in adjacent tabs. */
function migrateLegacyLocalStorageOnce() {
  try {
    if (!sessionStorage.getItem(ACCESS_KEY)) {
      const legacyAccess = localStorage.getItem(LEGACY_ACCESS_KEY);
      if (legacyAccess) sessionStorage.setItem(ACCESS_KEY, legacyAccess);
    }
    localStorage.removeItem(LEGACY_ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(LEGACY_TIER_KEY);
  } catch (_) {}
}

export function initAuthStorage() {
  migrateLegacyLocalStorageOnce();
}

export function getAccessToken() {
  try {
    return sessionStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken() {
  try {
    return sessionStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setAuthTokens({ accessToken, refreshToken }) {
  try {
    if (accessToken) sessionStorage.setItem(ACCESS_KEY, accessToken);
    else sessionStorage.removeItem(ACCESS_KEY);
    if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
    else sessionStorage.removeItem(REFRESH_KEY);
  } catch (_) {}
}

export function clearAuthTokens() {
  try {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
  } catch (_) {}
}

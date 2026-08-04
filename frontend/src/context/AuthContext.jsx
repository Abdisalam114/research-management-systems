import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import * as authApi from "../services/authApi";
import {
  getAccessToken,
  getRefreshToken,
  initAuthStorage,
  setAuthTokens,
} from "../utils/authStorage";
import { isCrossTierRole } from "../constants/programTier";
import { clearProgramTier } from "../utils/programTierStorage";
import { SYSTEM_REFRESH_MS } from "../constants/systemRefresh";

export const AuthContext = createContext(null);

initAuthStorage();

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => getAccessToken());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyTokens = useCallback(({ accessToken: nextAccess, refreshToken: nextRefresh }) => {
    setAccessToken(nextAccess || null);
    setAuthTokens({ accessToken: nextAccess || null, refreshToken: nextRefresh || null });
  }, []);

  const loadMe = useCallback(async (token) => {
    if (!token) {
      setUser(null);
      return;
    }
    const res = await authApi.me(token);
    setUser(res.user);
    return res.user;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const storedAccess = getAccessToken();
        const storedRefresh = getRefreshToken();

        if (storedAccess) {
          try {
            const loadedUser = await loadMe(storedAccess);
            if (!cancelled) {
            }
            return;
          } catch {
            if (!storedRefresh) throw new Error("access expired");
          }
        }

        if (storedRefresh) {
          const refreshed = await authApi.refresh(storedRefresh);
          applyTokens({
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken || storedRefresh,
          });
          const loadedUser = await loadMe(refreshed.accessToken);
          if (!cancelled) {
          }
          return;
        }
      } catch {
        applyTokens({ accessToken: null, refreshToken: null });
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyTokens, loadMe]);

  useEffect(() => {
    function onTokensUpdated(event) {
      const next = event?.detail?.accessToken;
      if (next) {
        applyTokens({ accessToken: next, refreshToken: getRefreshToken() });
      }
    }
    window.addEventListener("rms:tokens-updated", onTokensUpdated);
    return () => window.removeEventListener("rms:tokens-updated", onTokensUpdated);
  }, [applyTokens]);

  useEffect(() => {
    if (!accessToken || !getRefreshToken()) return undefined;
    let cancelled = false;

    async function refreshSession() {
      try {
        const storedRefresh = getRefreshToken();
        if (!storedRefresh || cancelled) return;
        const refreshed = await authApi.refresh(storedRefresh);
        applyTokens({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken || storedRefresh,
        });
        await loadMe(refreshed.accessToken);
      } catch {
        /* next API 401 will surface if refresh truly failed */
      }
    }

    const timer = setInterval(refreshSession, SYSTEM_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [accessToken, applyTokens, loadMe]);

  const signIn = useCallback(
    async (email, password) => {
      const res = await authApi.login({ email, password });
      applyTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUser(res.user);
      // Shared staff must re-select UG or PG portal after each sign-in
      if (isCrossTierRole(res.user?.role)) {
        clearProgramTier();
      }
      return res;
    },
    [applyTokens]
  );

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      await authApi.logout(refreshToken);
    } finally {
      applyTokens({ accessToken: null, refreshToken: null });
      setUser(null);
      clearProgramTier();
    }
  }, [applyTokens]);

  const value = useMemo(
    () => ({
      accessToken,
      user,
      loading,
      isAuthenticated: Boolean(accessToken && user),
      setToken: (token) => applyTokens({ accessToken: token, refreshToken: getRefreshToken() }),
      loadMe,
      signIn,
      signOut,
    }),
    [accessToken, user, loading, applyTokens, loadMe, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

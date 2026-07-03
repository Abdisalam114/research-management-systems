import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import * as authApi from "../services/authApi";
import {
  getAccessToken,
  getRefreshToken,
  initAuthStorage,
  setAuthTokens,
} from "../utils/authStorage";
import { clearProgramTier } from "../utils/programTierStorage";

export const AuthContext = createContext(null);

initAuthStorage();

function logAuthDebug(message, data) {
  // #region agent log
  fetch("http://127.0.0.1:7722/ingest/c087732c-3b1c-46dd-980e-52f3f7e71eec", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "15a9cf" },
    body: JSON.stringify({
      sessionId: "15a9cf",
      location: "AuthContext.jsx",
      message,
      data,
      hypothesisId: "H-TAB-SESSION",
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

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
              logAuthDebug("session bootstrap from access token", {
                email: loadedUser?.email,
                role: loadedUser?.role,
              });
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
            logAuthDebug("session bootstrap from refresh token", {
              email: loadedUser?.email,
              role: loadedUser?.role,
            });
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

  const signIn = useCallback(
    async (email, password) => {
      const res = await authApi.login({ email, password });
      applyTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUser(res.user);
      if (res.user?.role === "research_director") {
        clearProgramTier();
      }
      logAuthDebug("signIn", { email: res.user?.email, role: res.user?.role });
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
      logAuthDebug("signOut", { cleared: true });
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

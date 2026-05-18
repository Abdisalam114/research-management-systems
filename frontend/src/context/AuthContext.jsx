import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import * as authApi from "../services/authApi";

export const AuthContext = createContext(null);

const STORAGE_KEY = "just_rms_access_token";

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setToken = useCallback((token) => {
    setAccessToken(token);
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadMe = useCallback(
    async (token) => {
      if (!token) {
        setUser(null);
        return;
      }
      const res = await authApi.me(token);
      setUser(res.user);
    },
    [setUser]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (accessToken) {
          await loadMe(accessToken);
          if (!cancelled) setLoading(false);
          return;
        }

        // Try cookie-based refresh to bootstrap a new access token
        const refreshed = await authApi.refresh();
        setToken(refreshed.accessToken);
        await loadMe(refreshed.accessToken);
      } catch {
        setToken(null);
        setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (email, password) => {
      const res = await authApi.login({ email, password });
      setToken(res.accessToken);
      setUser(res.user);
      return res;
    },
    [setToken]
  );

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setToken(null);
      setUser(null);
    }
  }, [setToken]);

  const value = useMemo(
    () => ({
      accessToken,
      user,
      loading,
      isAuthenticated: Boolean(accessToken && user),
      setToken,
      loadMe,
      signIn,
      signOut,
    }),
    [accessToken, user, loading, setToken, loadMe, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


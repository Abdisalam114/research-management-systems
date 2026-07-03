import { api } from "./api";

export async function register(payload) {
  const { data } = await api.post("/api/auth/register", payload);
  return data;
}

export async function login(payload) {
  const { data } = await api.post("/api/auth/login", payload);
  return data;
}

export async function logout(refreshToken) {
  const { data } = await api.post("/api/auth/logout", refreshToken ? { refreshToken } : {});
  return data;
}

export async function refresh(refreshToken) {
  const { data } = await api.post("/api/auth/refresh", refreshToken ? { refreshToken } : {});
  return data;
}

export async function me(accessToken) {
  const { data } = await api.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}


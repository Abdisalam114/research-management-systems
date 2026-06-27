import { api } from "./api";

export async function register(payload) {
  const { data } = await api.post("/api/auth/register", payload);
  return data;
}

export async function login(payload) {
  const { data } = await api.post("/api/auth/login", payload);
  return data;
}

export async function logout() {
  const { data } = await api.post("/api/auth/logout");
  return data;
}

export async function refresh() {
  const { data } = await api.post("/api/auth/refresh");
  return data;
}

export async function me(accessToken) {
  const { data } = await api.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}


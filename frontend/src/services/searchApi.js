import { api } from "./api";

export async function globalSearch(accessToken, q) {
  const { data } = await api.get("/api/search", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q },
  });
  return data;
}

export async function listRecentAudit(accessToken, params = {}) {
  const { data } = await api.get("/api/audit/recent", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });
  return data;
}

import { api } from "./api";

export async function globalSearch(accessToken, q) {
  const res = await api.get("/api/search", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { q },
  });
  return res.data;
}

export async function getEntityAudit(accessToken, entityType, entityId) {
  const res = await api.get(`/api/audit/${entityType}/${entityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function listRecentAudit(accessToken, params = {}) {
  const res = await api.get("/api/audit/recent", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });
  return res.data;
}

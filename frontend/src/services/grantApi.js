import { api } from "./api";

export async function listGrants(accessToken, params = {}) {
  const res = await api.get("/api/grants", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });
  return res.data;
}

export async function getGrant(accessToken, id) {
  const res = await api.get(`/api/grants/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.data;
}

export async function createGrant(accessToken, payload) {
  const res = await api.post("/api/grants", payload, { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.data;
}

export async function updateGrant(accessToken, id, payload) {
  const res = await api.put(`/api/grants/${id}`, payload, { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.data;
}

export async function submitGrant(accessToken, id) {
  const res = await api.post(`/api/grants/${id}/submit`, null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function directorDecision(accessToken, id, payload) {
  const res = await api.post(`/api/grants/${id}/director-decision`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

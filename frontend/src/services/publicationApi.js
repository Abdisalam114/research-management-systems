import { api } from "./api";

export async function listPublications(accessToken) {
  const res = await api.get("/api/publications", { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.data;
}

export async function createPublication(accessToken, payload) {
  const res = await api.post("/api/publications", payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function submitPublication(accessToken, id) {
  const res = await api.post(`/api/publications/${id}/submit`, null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function validatePublication(accessToken, id, payload) {
  const res = await api.post(`/api/publications/${id}/validate`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

import { api } from "./api";

export async function listPolicies(accessToken) {
  const res = await api.get("/api/policies", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function getPolicy(accessToken, id) {
  const res = await api.get(`/api/policies/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function createPolicy(accessToken, payload) {
  const res = await api.post("/api/policies", payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function updatePolicy(accessToken, id, payload) {
  const res = await api.put(`/api/policies/${id}`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function deletePolicy(accessToken, id) {
  const res = await api.delete(`/api/policies/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

import { api } from "./api";

export async function listPolicies(accessToken, params = {}) {
  const { data } = await api.get("/api/policies", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });
  return data;
}

export async function createPolicy(accessToken, body) {
  const { data } = await api.post("/api/policies", body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function updatePolicy(accessToken, id, body) {
  const { data } = await api.put(`/api/policies/${id}`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

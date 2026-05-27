import { api } from "./api";

export async function listGroups(accessToken) {
  const res = await api.get("/api/groups", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: { kind: "collaboration" },
  });
  return res.data;
}

export async function groupStats(accessToken) {
  const res = await api.get("/api/groups/stats", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function createGroup(accessToken, payload) {
  const res = await api.post("/api/groups", payload, { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.data;
}

export async function joinGroup(accessToken, id) {
  const res = await api.post(`/api/groups/${id}/join`, null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function leaveGroup(accessToken, id) {
  const res = await api.post(`/api/groups/${id}/leave`, null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

import { api } from "./api";

export async function listPendingUsers(accessToken) {
  const res = await api.get("/api/users/pending", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function listUsers(accessToken, params = {}) {
  const res = await api.get("/api/users", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });
  return res.data;
}

export async function createUser(accessToken, body) {
  const res = await api.post("/api/users", body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

export async function approveUser(accessToken, userId) {
  const res = await api.post(
    `/api/users/${userId}/approve`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}

export async function rejectUser(accessToken, userId) {
  const res = await api.post(
    `/api/users/${userId}/reject`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}

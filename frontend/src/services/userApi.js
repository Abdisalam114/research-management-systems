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

/** Research Director only (backend enforces). Hard-deletes the account. */
export async function deleteUser(accessToken, userId) {
  const res = await api.delete(`/api/users/${userId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

/** Research Director only — update name, department, rank, role, status, protection. */
export async function updateUser(accessToken, userId, body) {
  const res = await api.put(`/api/users/${userId}`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

import { api } from "./api";

function authHeaders(accessToken) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

export async function listDepartments(accessToken) {
  const { data } = await api.get("/api/departments", authHeaders(accessToken));
  return data;
}

export async function createDepartment(accessToken, body) {
  const { data } = await api.post("/api/departments", body, authHeaders(accessToken));
  return data;
}

export async function updateDepartment(accessToken, id, body) {
  const { data } = await api.put(`/api/departments/${id}`, body, authHeaders(accessToken));
  return data;
}

export async function deleteDepartment(accessToken, id) {
  const { data } = await api.delete(`/api/departments/${id}`, authHeaders(accessToken));
  return data;
}

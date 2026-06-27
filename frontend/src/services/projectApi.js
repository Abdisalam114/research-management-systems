import { api } from "./api";

export async function listProjects(accessToken) {
  const { data } = await api.get("/api/projects", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function getProject(accessToken, id) {
  const { data } = await api.get(`/api/projects/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function updateProject(accessToken, id, body) {
  const { data } = await api.put(`/api/projects/${id}`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function addProgress(accessToken, id, note, progressPercent) {
  const { data } = await api.post(
    `/api/projects/${id}/progress`,
    { note, progressPercent },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}


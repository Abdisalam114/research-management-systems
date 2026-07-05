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

export async function addCommunicationLog(accessToken, id, body) {
  const { data } = await api.post(`/api/projects/${id}/communication`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function submitClosure(accessToken, id, payload) {
  const { data } = await api.post(`/api/projects/${id}/closure/submit`, payload, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function directorClosureApproval(accessToken, id, comment) {
  const { data } = await api.post(
    `/api/projects/${id}/closure/director-approve`,
    { comment },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function financeClosureApproval(accessToken, id, comment) {
  const { data } = await api.post(
    `/api/projects/${id}/closure/finance-approve`,
    { comment },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

export async function archiveProject(accessToken, id) {
  const { data } = await api.post(
    `/api/projects/${id}/closure/archive`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}


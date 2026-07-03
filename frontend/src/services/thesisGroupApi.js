import { api } from "./api";

function authHeaders(accessToken) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

export async function listThesisGroups(accessToken) {
  const { data } = await api.get("/api/thesis-groups", authHeaders(accessToken));
  return data;
}

export async function getThesisGroup(accessToken, id) {
  const { data } = await api.get(`/api/thesis-groups/${id}`, authHeaders(accessToken));
  return data;
}

export async function createThesisGroup(accessToken, body) {
  const { data } = await api.post("/api/thesis-groups", body, authHeaders(accessToken));
  return data;
}

export async function updateThesisGroup(accessToken, id, body) {
  const { data } = await api.patch(`/api/thesis-groups/${id}`, body, authHeaders(accessToken));
  return data;
}

export async function addThesisMeeting(accessToken, id, body) {
  const { data } = await api.post(`/api/thesis-groups/${id}/meetings`, body, authHeaders(accessToken));
  return data;
}

export async function proposeThesisTitle(accessToken, id, body) {
  const { data } = await api.post(`/api/thesis-groups/${id}/title-proposal`, body, authHeaders(accessToken));
  return data;
}

export async function reviewThesisTitle(accessToken, id, body) {
  const { data } = await api.post(`/api/thesis-groups/${id}/title-proposal/review`, body, authHeaders(accessToken));
  return data;
}

export async function updateThesisChapter(accessToken, id, chapterKey, body) {
  const { data } = await api.patch(`/api/thesis-groups/${id}/chapters/${chapterKey}`, body, authHeaders(accessToken));
  return data;
}

export async function deleteThesisGroup(accessToken, id) {
  const { data } = await api.delete(`/api/thesis-groups/${id}`, authHeaders(accessToken));
  return data;
}

import { api } from "./api";
import { apiOrigin } from "../config/apiBase";

function auth(t) { return { headers: { Authorization: `Bearer ${t}` } }; }

export async function listEthicsApplications(t) {
  const { data } = await api.get("/api/ethics", auth(t));
  return data;
}

export async function getEthicsApplication(t, id) {
  const { data } = await api.get(`/api/ethics/${id}`, auth(t));
  return data;
}

export async function createEthicsApplication(t, body) {
  const { data } = await api.post("/api/ethics", body, auth(t));
  return data;
}

export async function updateEthicsApplication(t, id, body) {
  const { data } = await api.patch(`/api/ethics/${id}`, body, auth(t));
  return data;
}

export async function submitEthicsApplication(t, id) {
  const { data } = await api.post(`/api/ethics/${id}/submit`, {}, auth(t));
  return data;
}

export async function directorDecision(t, id, body) {
  const { data } = await api.post(`/api/ethics/${id}/director-decision`, body, auth(t));
  return data;
}

export async function previewCertificate(t, id) {
  const { data } = await api.get(`/api/ethics/${id}/certificate-preview`, auth(t));
  return data;
}

export async function downloadCertificate(t, id) {
  const res = await fetch(`${apiOrigin()}/api/ethics/${id}/certificate.pdf`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "Failed to download certificate");
    throw new Error(msg);
  }
  return res.blob();
}

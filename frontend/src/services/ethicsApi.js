import { api } from "./api";
import { apiOrigin } from "../config/apiBase";
import { PROGRAM_TIER_HEADER } from "../constants/programTier";
import { getProgramTier } from "../utils/programTierStorage";

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
  const headers = { Authorization: `Bearer ${t}` };
  const tier = getProgramTier();
  if (tier) headers[PROGRAM_TIER_HEADER] = tier;
  const res = await fetch(`${apiOrigin()}/api/ethics/${id}/certificate.pdf`, { headers });
  if (!res.ok) {
    let msg = "Failed to download certificate";
    try {
      const text = await res.text();
      const parsed = JSON.parse(text);
      if (parsed?.message) msg = parsed.message;
      else if (text) msg = text.slice(0, 200);
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  return res.blob();
}

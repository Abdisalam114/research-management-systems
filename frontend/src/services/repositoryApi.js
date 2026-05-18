import { api } from "./api";

export async function listRepositoryItems(accessToken) {
  const res = await api.get("/api/repository", { headers: { Authorization: `Bearer ${accessToken}` } });
  return res.data;
}

export async function uploadRepositoryItem(accessToken, formData) {
  const res = await api.post("/api/repository/upload", formData, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

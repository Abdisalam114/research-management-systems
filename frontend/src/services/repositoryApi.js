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

async function downloadExport(accessToken, path, filename) {
  const res = await api.get(path, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: "blob",
  });
  const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadRepositoryCsv(accessToken) {
  return downloadExport(accessToken, "/api/repository/export/csv", "JUST-RMS-Repository.csv");
}

export async function downloadRepositoryExcel(accessToken) {
  return downloadExport(accessToken, "/api/repository/export/excel", "JUST-RMS-Repository.xls");
}

export async function downloadRepositoryPdf(accessToken) {
  return downloadExport(accessToken, "/api/repository/export/pdf", "JUST-RMS-Repository.pdf");
}

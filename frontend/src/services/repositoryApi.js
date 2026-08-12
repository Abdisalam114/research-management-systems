import { api } from "./api";
import { blobErrorMessage, triggerBlobDownload } from "../utils/downloadBlob";

export async function listRepositoryItems(accessToken, params = {}) {
  const res = await api.get("/api/repository", {
    headers: { Authorization: `Bearer ${accessToken}` },
    params,
  });
  return res.data;
}

export async function uploadRepositoryItem(accessToken, formData) {
  const res = await api.post("/api/repository/upload", formData, {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Axios must set multipart boundary itself — never force Content-Type here
    transformRequest: [
      (data, headers) => {
        if (typeof FormData !== "undefined" && data instanceof FormData) {
          if (headers && typeof headers.delete === "function") headers.delete("Content-Type");
          else if (headers) delete headers["Content-Type"];
        }
        return data;
      },
    ],
  });
  return res.data;
}

export async function deleteRepositoryItem(accessToken, id) {
  const res = await api.delete(`/api/repository/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

async function downloadExport(accessToken, path, filename, params = {}) {
  try {
    const res = await api.get(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params,
      responseType: "blob",
    });
    const blob = new Blob([res.data], { type: res.headers["content-type"] || "application/octet-stream" });
    triggerBlobDownload(blob, filename);
  } catch (e) {
    throw new Error(await blobErrorMessage(e, "Export failed"));
  }
}

export async function downloadRepositoryCsv(accessToken, params = {}) {
  return downloadExport(accessToken, "/api/repository/export/csv", "JUST-RMS-Repository.csv", params);
}

export async function downloadRepositoryExcel(accessToken, params = {}) {
  return downloadExport(accessToken, "/api/repository/export/excel", "JUST-RMS-Repository.xls", params);
}

export async function downloadRepositoryPdf(accessToken, params = {}) {
  return downloadExport(accessToken, "/api/repository/export/pdf", "JUST-RMS-Repository.pdf", params);
}

export async function openRepositoryFile(accessToken, id, filename = "repository-file") {
  try {
    const res = await api.get(`/api/repository/${id}/file`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: "blob",
    });
    const type = res.headers["content-type"] || "application/octet-stream";
    const blob = new Blob([res.data], { type });
    let name = filename || "repository-file";
    if (!/\.\w{2,5}$/.test(name)) {
      if (type.includes("pdf")) name = `${name}.pdf`;
      else if (type.includes("word") || type.includes("msword")) name = `${name}.doc`;
      else if (type.includes("sheet") || type.includes("excel")) name = `${name}.xls`;
    }
    triggerBlobDownload(blob, name);
  } catch (e) {
    throw new Error(await blobErrorMessage(e, "Could not open file"));
  }
}

import { apiOrigin } from "../config/apiBase";
import { triggerBlobDownload } from "./downloadBlob";

function fileNameFromPath(filePath) {
  const parts = String(filePath || "").split("/");
  return parts[parts.length - 1] || "download";
}

export async function fetchProtectedUpload(accessToken, filePath) {
  const res = await fetch(`${apiOrigin()}/api/files?path=${encodeURIComponent(filePath)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("File not found on server");
  return res.blob();
}

export async function openProtectedUpload(accessToken, filePath) {
  const blob = await fetchProtectedUpload(accessToken, filePath);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadProtectedUpload(accessToken, filePath, filename) {
  const blob = await fetchProtectedUpload(accessToken, filePath);
  triggerBlobDownload(blob, filename || fileNameFromPath(filePath));
}

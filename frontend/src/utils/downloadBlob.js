/** Trigger a browser file download from a Blob/File. */
export function triggerBlobDownload(blob, filename = "download") {
  if (!blob) throw new Error("Nothing to download");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = String(filename || "download").replace(/[^\w.\-()+\s]+/g, "_").slice(0, 120) || "download";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** If axios received an error JSON as a Blob (responseType: blob), surface the message. */
export async function blobErrorMessage(error, fallback = "Download failed") {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.message) return parsed.message;
      if (text) return text.slice(0, 200);
    } catch {
      /* keep fallback */
    }
  }
  return error?.response?.data?.message || error?.message || fallback;
}

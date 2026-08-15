const fs = require("fs");
const path = require("path");
const { AppError } = require("./AppError");

function uploadsRoot() {
  return path.resolve(process.cwd(), "uploads");
}

/** Resolve `/uploads/...` to a real file under the uploads directory (no path traversal). */
function resolveProtectedUpload(filePath) {
  const raw = String(filePath || "").replace(/\\/g, "/").trim();
  if (!raw.startsWith("/uploads/")) throw new AppError("Invalid file path", 400);
  if (raw.includes("..")) throw new AppError("Invalid file path", 400);
  const abs = path.resolve(process.cwd(), raw.replace(/^\//, ""));
  const root = uploadsRoot();
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (abs !== root && !abs.startsWith(prefix)) throw new AppError("Invalid file path", 400);
  return abs;
}

function sendProtectedUpload(res, filePath, { downloadName } = {}) {
  const abs = resolveProtectedUpload(filePath);
  if (!fs.existsSync(abs)) throw new AppError("File not found on server", 404);
  const name = downloadName || path.basename(abs);
  return res.sendFile(abs, {
    headers: {
      "Content-Disposition": `inline; filename="${String(name).replace(/"/g, "")}"`,
    },
  });
}

module.exports = { uploadsRoot, resolveProtectedUpload, sendProtectedUpload };

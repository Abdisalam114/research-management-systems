const multer = require("multer");
const path = require("path");
const { storage } = require("./upload");

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const ALLOWED_EXT = new Set([".pdf", ".csv", ".xlsx", ".xls"]);

function repositoryFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (ALLOWED_EXT.has(ext) || ALLOWED_MIMES.has(file.mimetype)) {
    return cb(null, true);
  }
  return cb(new Error("Only PDF, CSV, and Excel (.xlsx/.xls) files are allowed"));
}

const repositoryUpload = multer({
  storage,
  fileFilter: repositoryFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = { repositoryUpload };

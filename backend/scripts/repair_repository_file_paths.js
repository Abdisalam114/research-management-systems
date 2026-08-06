/**
 * Normalize repository item filePath to web-relative /uploads/... paths.
 * node backend/scripts/repair_repository_file_paths.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

function normalizeStoredFilePath(filePath) {
  if (!filePath) return "";
  const normalized = String(filePath).replace(/\\/g, "/");
  if (normalized.startsWith("/uploads/")) return normalized;
  const marker = "/uploads/";
  const idx = normalized.toLowerCase().indexOf(marker);
  if (idx >= 0) return normalized.slice(idx);
  return normalized;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rms");
  const col = mongoose.connection.db.collection("repositoryitems");
  const all = await col.find({}).toArray();
  let fixed = 0;
  for (const item of all) {
    const next = normalizeStoredFilePath(item.filePath);
    if (next && next !== item.filePath) {
      await col.updateOne({ _id: item._id }, { $set: { filePath: next } });
      console.log(`Fixed: ${item.title}\n  ${item.filePath}\n  -> ${next}`);
      fixed += 1;
    }
  }
  console.log(`Done. ${fixed} path(s) repaired out of ${all.length} items.`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

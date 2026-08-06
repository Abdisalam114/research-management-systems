/**
 * Export the full RMS MongoDB database to JSON (Extended JSON) files.
 *
 * Usage:
 *   node backend/scripts/exportMongoDb.js
 *   node backend/scripts/exportMongoDb.js --out ./data/mongo-export/my-backup
 *   node backend/scripts/exportMongoDb.js --collections users,proposals,projects
 *
 * Default output: backend/data/mongo-export/snapshot/
 * Copy that folder to another server, then run importMongoDb.js there.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { DEFAULT_EXPORT_DIR, resolveExportDir, exportMongoDb } = require("./mongoDumpLib");

function readFlag(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

const outArg = readFlag("--out");
const collectionsArg = readFlag("--collections");
const collections = collectionsArg
  ? collectionsArg
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

(async () => {
  const exportDir = resolveExportDir(outArg || DEFAULT_EXPORT_DIR);
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rms");

  const result = await exportMongoDb(mongoose.connection.db, exportDir, { collections });

  console.log(
    JSON.stringify(
      {
        action: "export",
        exportDir: result.exportDir,
        dbName: result.manifest.dbName,
        exportedAt: result.manifest.exportedAt,
        totalDocuments: result.totalDocuments,
        collections: result.manifest.collections,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

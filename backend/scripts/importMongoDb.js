/**
 * Import RMS MongoDB data from JSON (Extended JSON) export files.
 *
 * Usage:
 *   node backend/scripts/importMongoDb.js --yes
 *   node backend/scripts/importMongoDb.js --from ./data/mongo-export/snapshot --yes
 *   node backend/scripts/importMongoDb.js --mode merge --yes
 *
 * Modes:
 *   replace (default) — clears each collection, then inserts export data
 *   merge             — upsert documents by _id (keeps other rows)
 *
 * WARNING: replace mode overwrites database content. Pass --yes to confirm.
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { DEFAULT_EXPORT_DIR, resolveExportDir, importMongoDb, readManifest } = require("./mongoDumpLib");

function readFlag(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

const fromArg = readFlag("--from");
const modeArg = readFlag("--mode") || "replace";
const confirmed = process.argv.includes("--yes");

if (!confirmed) {
  console.error("Refusing to import without --yes (this can overwrite MongoDB data).");
  process.exit(1);
}

if (!["replace", "merge"].includes(modeArg)) {
  console.error(`Invalid --mode "${modeArg}". Use replace or merge.`);
  process.exit(1);
}

(async () => {
  const exportDir = resolveExportDir(fromArg || DEFAULT_EXPORT_DIR);
  const manifest = readManifest(exportDir);

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rms");

  const targetDb = mongoose.connection.db.databaseName;
  if (targetDb !== manifest.dbName) {
    console.warn(
      `Warning: export dbName="${manifest.dbName}" but target dbName="${targetDb}". Continuing import.`
    );
  }

  const result = await importMongoDb(mongoose.connection.db, exportDir, { mode: modeArg });

  console.log(
    JSON.stringify(
      {
        action: "import",
        mode: modeArg,
        exportDir: result.exportDir,
        sourceExportedAt: result.manifest.exportedAt,
        targetDb,
        results: result.results,
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

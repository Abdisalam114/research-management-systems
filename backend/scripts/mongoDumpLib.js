const fs = require("fs");
const path = require("path");
const { EJSON } = require("bson");

const DEFAULT_EXPORT_DIR = path.join(__dirname, "../data/mongo-export/snapshot");

function resolveExportDir(input) {
  if (!input) return DEFAULT_EXPORT_DIR;
  return path.isAbsolute(input) ? input : path.resolve(process.cwd(), input);
}

function listCollectionFiles(exportDir) {
  return fs
    .readdirSync(exportDir)
    .filter((name) => name.endsWith(".json") && name !== "manifest.json")
    .map((name) => name.replace(/\.json$/, ""))
    .sort();
}

function readManifest(exportDir) {
  const manifestPath = path.join(exportDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found in ${exportDir}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

async function listDbCollections(db) {
  const names = (await db.listCollections().toArray())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("system."))
    .sort();
  return names;
}

async function exportMongoDb(db, exportDir, { collections = null } = {}) {
  fs.mkdirSync(exportDir, { recursive: true });

  const allCollections = await listDbCollections(db);
  const selected =
    collections && collections.length > 0
      ? allCollections.filter((name) => collections.includes(name))
      : allCollections;

  const missing = (collections || []).filter((name) => !allCollections.includes(name));
  if (missing.length > 0) {
    throw new Error(`Unknown collection(s): ${missing.join(", ")}`);
  }

  const manifest = {
    exportedAt: new Date().toISOString(),
    dbName: db.databaseName,
    collections: {},
  };

  for (const name of selected) {
    const docs = await db.collection(name).find({}).toArray();
    manifest.collections[name] = docs.length;
    fs.writeFileSync(
      path.join(exportDir, `${name}.json`),
      EJSON.stringify(docs, { relaxed: false })
    );
  }

  fs.writeFileSync(path.join(exportDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  return {
    exportDir,
    manifest,
    totalDocuments: Object.values(manifest.collections).reduce((sum, n) => sum + n, 0),
  };
}

async function importMongoDb(db, exportDir, { mode = "replace" } = {}) {
  const manifest = readManifest(exportDir);
  const collectionNames =
    manifest.collectionOrder && manifest.collectionOrder.length > 0
      ? manifest.collectionOrder
      : listCollectionFiles(exportDir);

  const results = [];

  for (const name of collectionNames) {
    const filePath = path.join(exportDir, `${name}.json`);
    if (!fs.existsSync(filePath)) continue;

    const docs = EJSON.parse(fs.readFileSync(filePath, "utf8"));
    const collection = db.collection(name);

    if (mode === "replace") {
      await collection.deleteMany({});
      if (docs.length > 0) {
        await collection.insertMany(docs, { ordered: false });
      }
      results.push({ collection: name, mode, imported: docs.length });
      continue;
    }

    if (mode === "merge") {
      if (docs.length === 0) {
        results.push({ collection: name, mode, imported: 0, upserted: 0 });
        continue;
      }
      const ops = docs.map((doc) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      const res = await collection.bulkWrite(ops, { ordered: false });
      results.push({
        collection: name,
        mode,
        imported: docs.length,
        upserted: res.upsertedCount + res.modifiedCount + res.matchedCount,
      });
      continue;
    }

    throw new Error(`Unsupported import mode: ${mode}`);
  }

  return { exportDir, manifest, results };
}

module.exports = {
  DEFAULT_EXPORT_DIR,
  resolveExportDir,
  exportMongoDb,
  importMongoDb,
  readManifest,
};

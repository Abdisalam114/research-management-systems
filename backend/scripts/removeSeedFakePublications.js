/**
 * Remove seed/demo publications (fake DOI 10.1000/rms.* or batch seed titles
 * linked to wrong projects). Keeps researcher-registered outputs only.
 * Run: node scripts/removeSeedFakePublications.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { PUBLICATION_TEMPLATES } = require("../src/scripts/seedRecords");

const SEED_DOI = /^10\.1000\/rms\./i;
const seedTitles = new Set(PUBLICATION_TEMPLATES.map((t) => t.title.toLowerCase().trim()));

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const pubs = await db.collection("publications").find({}).toArray();
  const projects = await db.collection("projects").find({}).project({ title: 1 }).toArray();
  const projectById = Object.fromEntries(projects.map((p) => [String(p._id), p]));

  const removed = [];
  const kept = [];

  for (const pub of pubs) {
    const proj = projectById[String(pub.projectId)] || null;
    const titleMatch = proj && norm(pub.title) === norm(proj.title);
    const isSeedDoi = SEED_DOI.test(pub.doi || "");
    const isSeedTitle = seedTitles.has(String(pub.title).toLowerCase().trim());
    const isFakeSeed = isSeedDoi || (isSeedTitle && !titleMatch);

    if (isFakeSeed) {
      await db.collection("publications").deleteOne({ _id: pub._id });
      removed.push({
        title: pub.title,
        projectTitle: proj?.title || null,
        reason: isSeedDoi ? "seed_doi" : "seed_title_wrong_project",
      });
    } else {
      kept.push({ title: pub.title, projectTitle: proj?.title || null });
    }
  }

  const payload = {
    sessionId: "f558f7",
    hypothesisId: "READ2",
    message: "removed fake seed publications — only read from real project outputs",
    data: {
      removedCount: removed.length,
      keptCount: kept.length,
      removed,
      kept,
      rule: "Publications menu reads project-linked outputs; seed fake data removed",
    },
    timestamp: Date.now(),
  };

  fs.appendFileSync(path.join(__dirname, "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

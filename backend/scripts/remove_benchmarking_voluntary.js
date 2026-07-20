/**
 * Remove voluntary "Benchmarking Gradient Boosting..." project and all linked records.
 * Run: node scripts/remove_benchmarking_voluntary.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const TITLE = "Benchmarking Gradient Boosting for Educational Risk Prediction";
const TITLE_RE = /Benchmarking Gradient Boosting for Educational Risk Prediction/i;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const projects = await db.collection("projects").find({ title: TITLE_RE }).toArray();
  const proposals = await db.collection("proposals").find({ title: TITLE_RE }).toArray();
  const projectIds = projects.map((p) => p._id);
  const proposalIds = [
    ...proposals.map((p) => p._id),
    ...projects.map((p) => p.proposalId).filter(Boolean),
  ];

  const pubsByTitle = await db.collection("publications").find({ title: TITLE_RE }).toArray();
  const pubsByProject =
    projectIds.length > 0
      ? await db.collection("publications").find({ projectId: { $in: projectIds } }).toArray()
      : [];

  const pubIds = [...pubsByTitle, ...pubsByProject].map((p) => p._id);

  const del = async (col, filter) => {
    const r = await db.collection(col).deleteMany(filter);
    return r.deletedCount;
  };

  const counts = {};
  if (projectIds.length) {
    counts.grants = await del("grants", { projectId: { $in: projectIds } });
    counts.budgets = await del("budgets", { projectId: { $in: projectIds } });
    counts.repository = await del("repositoryitems", { projectId: { $in: projectIds } });
    counts.ethics = await del("ethicsapplications", { projectId: { $in: projectIds } });
  }
  counts.publications = pubIds.length
    ? await del("publications", { _id: { $in: pubIds } })
    : await del("publications", { title: TITLE_RE });
  counts.projects = await del("projects", { title: TITLE_RE });
  counts.proposals = proposalIds.length
    ? await del("proposals", { _id: { $in: proposalIds } })
    : await del("proposals", { title: TITLE_RE });

  const remaining = {
    projects: await db.collection("projects").countDocuments({ title: TITLE_RE }),
    proposals: await db.collection("proposals").countDocuments({ title: TITLE_RE }),
    publications: await db.collection("publications").countDocuments({ title: TITLE_RE }),
  };

  const payload = {
    sessionId: "f558f7",
    hypothesisId: "RM1",
    message: "removed Benchmarking voluntary from system",
    data: { removed: counts, remaining, projectsFound: projects.length, proposalsFound: proposals.length },
    timestamp: Date.now(),
  };

  fs.appendFileSync(path.join(__dirname, "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

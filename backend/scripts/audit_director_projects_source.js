require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const projects = await db
    .collection("projects")
    .find({})
    .project({ title: 1, status: 1, researcherId: 1, proposalId: 1, programTier: 1 })
    .toArray();

  const proposalIds = projects.map((p) => p.proposalId).filter(Boolean);
  const proposals = await db
    .collection("proposals")
    .find({ _id: { $in: proposalIds } })
    .project({ title: 1, status: 1, proposalKind: 1 })
    .toArray();
  const propById = Object.fromEntries(proposals.map((p) => [String(p._id), p]));

  const researcherIds = projects.map((p) => p.researcherId).filter(Boolean);
  const users = await db
    .collection("users")
    .find({ _id: { $in: researcherIds } })
    .project({ fullName: 1, email: 1 })
    .toArray();
  const userById = Object.fromEntries(users.map((u) => [String(u._id), u]));

  const byTier = {};
  for (const p of projects) {
    const t = p.programTier || "unset";
    byTier[t] = (byTier[t] || 0) + 1;
  }

  const rows = projects.map((p) => ({
    title: p.title,
    status: p.status,
    programTier: p.programTier || null,
    owner: userById[String(p.researcherId)]?.fullName || null,
    fromProposal: propById[String(p.proposalId)]?.title || null,
    proposalStatus: propById[String(p.proposalId)]?.status || null,
    proposalKind: propById[String(p.proposalId)]?.proposalKind || null,
  }));

  const data = {
    mongoDb: "rms",
    collection: "projects",
    api: "GET /api/projects",
    directorFilter:
      "research_director sees all projects in selected program tier (UG or PG header) — NOT only own projects",
    total: projects.length,
    byTier,
    rows,
  };

  fs.appendFileSync(
    path.join(__dirname, "..", "debug-f558f7.log"),
    JSON.stringify({
      sessionId: "f558f7",
      hypothesisId: "DIR1",
      message: "director Projects menu data origin",
      data: {
        collection: data.collection,
        api: data.api,
        directorFilter: data.directorFilter,
        total: data.total,
        byTier: data.byTier,
      },
      timestamp: Date.now(),
    }) + "\n"
  );

  console.log(JSON.stringify(data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Enforce 1:1 — keep one publication per projectId (best by status/recency).
 * Run: node scripts/enforceOnePublicationPerProject.js
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { Publication } = require("../src/models/Publication");
const { Project } = require("../src/models/Project");
const { pickPublicationForProject } = require("../src/utils/projectScopedRecords");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const pubs = await Publication.find({ projectId: { $ne: null } }).sort({ updatedAt: -1 });
  const projects = await Project.find({}).select("_id title");
  const projectById = Object.fromEntries(projects.map((p) => [String(p._id), p]));

  const byProject = new Map();
  for (const pub of pubs) {
    const key = String(pub.projectId);
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key).push(pub);
  }

  let removed = 0;
  const kept = [];
  const removedTitles = [];

  for (const [projectId, group] of byProject.entries()) {
    const project = projectById[projectId] || { _id: projectId, title: "(unknown)" };
    const winner = pickPublicationForProject(group, project);
    if (!winner) continue;
    kept.push(String(winner._id));
    for (const pub of group) {
      if (String(pub._id) === String(winner._id)) continue;
      removedTitles.push({ project: project.title, title: pub.title, id: String(pub._id) });
      await Publication.deleteOne({ _id: pub._id });
      removed += 1;
    }
  }

  const after = await Publication.countDocuments({ projectId: { $ne: null } });
  const projectCount = await Project.countDocuments({});

  // Ensure unique index exists
  try {
    await Publication.collection.createIndex({ projectId: 1 }, { unique: true, sparse: true });
  } catch (e) {
    if (e.code !== 85 && e.code !== 86) throw e; // index exists / equivalent
  }

  const payload = {
    sessionId: "f558f7",
    hypothesisId: "ONE1",
    message: "1:1 enforcement complete",
    data: {
      projects: projectCount,
      publicationsAfter: after,
      removedDuplicates: removed,
      maxPerProject: 1,
      isOneToOne: after <= projectCount,
      keptCount: kept.length,
      sampleRemoved: removedTitles.slice(0, 8),
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

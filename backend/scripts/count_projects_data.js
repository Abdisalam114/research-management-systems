require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const projects = await db.collection("projects").find({}).toArray();
  const pubs = await db.collection("publications").find({}).toArray();
  const byStatus = {};
  const byOwner = {};
  for (const p of projects) {
    byStatus[p.status || "unknown"] = (byStatus[p.status || "unknown"] || 0) + 1;
    const o = String(p.researcherId || "none");
    byOwner[o] = (byOwner[o] || 0) + 1;
  }
  const withPub = projects.filter((p) =>
    pubs.some((pub) => pub.projectId && String(pub.projectId) === String(p._id))
  ).length;
  const pubsLinked = pubs.filter((p) => p.projectId).length;
  const data = {
    projectsTotal: projects.length,
    byStatus,
    projectsWithAtLeastOnePub: withPub,
    publicationsTotal: pubs.length,
    publicationsLinkedToProject: pubsLinked,
    titles: projects.map((p) => ({
      title: p.title,
      status: p.status,
      pubs: pubs.filter((pub) => pub.projectId && String(pub.projectId) === String(p._id)).length,
    })),
  };
  fs.appendFileSync(
    path.join(__dirname, "..", "debug-f558f7.log"),
    JSON.stringify({
      sessionId: "f558f7",
      hypothesisId: "COUNT1",
      message: "projects data inventory",
      data: {
        projectsTotal: data.projectsTotal,
        byStatus: data.byStatus,
        projectsWithAtLeastOnePub: data.projectsWithAtLeastOnePub,
        publicationsTotal: data.publicationsTotal,
        publicationsLinkedToProject: data.publicationsLinkedToProject,
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

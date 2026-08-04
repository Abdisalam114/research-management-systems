require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const LOG = path.join(__dirname, "..", "..", "debug-f558f7.log");
const ASHA = "6a3ff89d5e972763368b79d1";

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const pubs = await db.collection("publications").find({}).toArray();
  const projects = await db.collection("projects").find({}).toArray();
  const byId = Object.fromEntries(projects.map((p) => [String(p._id), p]));

  const mismatches = pubs
    .filter((p) => p.projectId)
    .map((p) => {
      const pr = byId[String(p.projectId)];
      const sameOwner = pr && String(pr.researcherId) === String(p.researcherId);
      return {
        pub: p.title,
        pubOwner: String(p.researcherId),
        project: pr?.title || null,
        projectOwner: pr ? String(pr.researcherId) : null,
        sameOwner,
      };
    })
    .filter((x) => !x.sameOwner);

  const ashaPubs = pubs.filter((p) => String(p.researcherId) === ASHA);
  const ashaProjects = projects.filter((p) => String(p.researcherId) === ASHA);
  const ashaPubProjectsInMyProjects = ashaPubs.filter((p) => {
    const pr = byId[String(p.projectId)];
    return pr && String(pr.researcherId) === ASHA;
  });

  const data = {
    totalPubs: pubs.length,
    ownerMismatch: mismatches.length,
    mismatches: mismatches.slice(0, 15),
    asha: {
      myProjects: ashaProjects.map((p) => p.title),
      myPubs: ashaPubs.length,
      pubsLinkedToMyProjects: ashaPubProjectsInMyProjects.length,
      pubsLinkedOutsideMyProjects: ashaPubs.length - ashaPubProjectsInMyProjects.length,
    },
  };
  fs.appendFileSync(
    LOG,
    JSON.stringify({
      sessionId: "f558f7",
      hypothesisId: "M1",
      message: "My Projects vs pubs ownership mismatch",
      data,
      timestamp: Date.now(),
    }) + "\n"
  );
  console.log(JSON.stringify(data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

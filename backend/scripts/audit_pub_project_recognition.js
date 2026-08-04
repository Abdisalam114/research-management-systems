require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const LOG = path.join(__dirname, "..", "..", "debug-f558f7.log");

function log(message, data) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({
      sessionId: "f558f7",
      hypothesisId: "R1",
      location: "audit_pub_project_recognition.js",
      message,
      data,
      timestamp: Date.now(),
    }) + "\n"
  );
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const shellProps = await db
    .collection("proposals")
    .find({
      $or: [
        { abstract: /linked from publication/i },
        { abstract: /Seeded voluntary proposal for publication/i },
        { researchArea: "Research Outputs" },
      ],
    })
    .toArray();

  const shellPropIds = new Set(shellProps.map((p) => String(p._id)));
  const projects = await db.collection("projects").find({}).toArray();
  const pubs = await db.collection("publications").find({}).toArray();
  const proposals = await db.collection("proposals").find({}).toArray();
  const propById = Object.fromEntries(proposals.map((p) => [String(p._id), p]));

  const shellProjects = projects.filter((p) => shellPropIds.has(String(p.proposalId)));
  const shellIds = new Set(shellProjects.map((p) => String(p._id)));
  const recognized = projects.filter((p) => !shellIds.has(String(p._id)));

  const pubsDetail = pubs.map((p) => {
    const pr = projects.find((x) => String(x._id) === String(p.projectId));
    const prop = pr?.proposalId ? propById[String(pr.proposalId)] : null;
    return {
      pubId: String(p._id),
      pub: p.title,
      projectId: p.projectId ? String(p.projectId) : null,
      project: pr?.title || null,
      projectStatus: pr?.status || null,
      isShell: pr ? shellIds.has(String(pr._id)) : false,
      proposalStatus: prop?.status || null,
      proposalApproved: prop?.status === "approved",
    };
  });

  const data = {
    shellProjectCount: shellProjects.length,
    recognizedProjectCount: recognized.length,
    pubsOnShell: pubsDetail.filter((x) => x.isShell).length,
    pubsOnRecognized: pubsDetail.filter((x) => x.project && !x.isShell).length,
    pubsWithoutApprovedProposal: pubsDetail.filter((x) => x.project && !x.proposalApproved).length,
    shellTitles: shellProjects.map((p) => p.title),
    recognizedTitles: recognized.map((p) => ({ title: p.title, status: p.status })),
  };

  log("recognized vs shell", data);
  console.log(JSON.stringify(data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

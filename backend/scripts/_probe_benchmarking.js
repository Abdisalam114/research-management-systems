require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL);
  const db = mongoose.connection.db;
  const pubs = db.collection("publications");
  const projects = db.collection("projects");
  const proposals = db.collection("proposals");
  const grants = db.collection("grants");

  const pub = await pubs.findOne({ title: /Benchmarking Gradient Boosting/i });
  let proj = null;
  let prop = null;
  let linkedGrants = [];
  if (pub?.projectId) {
    proj = await projects.findOne({ _id: pub.projectId });
  }
  const byTitle = await projects
    .find({ title: /Benchmarking Gradient Boosting|Predictive Analytics/i })
    .toArray();
  if (proj?.proposalId) {
    prop = await proposals.findOne({ _id: proj.proposalId });
  }
  if (proj) {
    linkedGrants = await grants
      .find({ projectId: proj._id })
      .project({ title: 1, status: 1, amountAwarded: 1, callId: 1 })
      .toArray();
  }
  const exactProj = await projects.findOne({ title: /Benchmarking Gradient Boosting/i });

  // write debug log
  const fs = require("fs");
  const path = require("path");
  const logPath = path.join(__dirname, "..", "..", "debug-f558f7.log");
  const payload = {
    sessionId: "f558f7",
    hypothesisId: "H1",
    location: "_probe_benchmarking.js",
    message: "Benchmarking pub/project kind state",
    data: {
      pub: pub && {
        _id: String(pub._id),
        title: pub.title,
        projectId: pub.projectId && String(pub.projectId),
        status: pub.status,
        researcherId: pub.researcherId && String(pub.researcherId),
      },
      linkedProject: proj && {
        _id: String(proj._id),
        title: proj.title,
        status: proj.status,
        proposalId: proj.proposalId && String(proj.proposalId),
        fundingCallId: proj.fundingCallId && String(proj.fundingCallId),
        researcherId: proj.researcherId && String(proj.researcherId),
      },
      proposal: prop && {
        _id: String(prop._id),
        title: prop.title,
        proposalKind: prop.proposalKind,
        fundingCallId: prop.fundingCallId && String(prop.fundingCallId),
        status: prop.status,
      },
      linkedGrants: linkedGrants.map((g) => ({
        title: g.title,
        status: g.status,
        amountAwarded: g.amountAwarded,
        callId: g.callId && String(g.callId),
      })),
      projectsMatchingTitles: byTitle.map((p) => ({
        _id: String(p._id),
        title: p.title,
        status: p.status,
        proposalId: p.proposalId && String(p.proposalId),
        fundingCallId: p.fundingCallId && String(p.fundingCallId),
      })),
      exactProjNamedBenchmarking: exactProj && {
        _id: String(exactProj._id),
        title: exactProj.title,
        status: exactProj.status,
      },
    },
    timestamp: Date.now(),
  };
  fs.appendFileSync(logPath, JSON.stringify(payload) + "\n");
  console.log(JSON.stringify(payload.data, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

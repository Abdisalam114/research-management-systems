/**
 * Relink shell-linked publications onto recognized Projects (topic map).
 * Deletes empty shell projects/proposals afterward.
 */
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
      runId: "relink-recognized-v2",
      hypothesisId: "R2",
      location: "relinkPubsToRecognizedProjects.js",
      message,
      data,
      timestamp: Date.now(),
    }) + "\n"
  );
}

/** pub title regex → recognized project title regex */
const MAP = [
  [/Mobile-First Architecture for Campus Event|Campus Event Coordination/i, /Campus Event Management/i],
  [/Diabetic Retinopathy/i, /Diabetic Retinopathy/i],
  [/Microgrid|Hybrid Microgrid/i, /Microgrid Energy Dispatch/i],
  [/De-identification of Clinical Narratives|Domain-Adapted Transformers/i, /Clinical Record De-identification/i],
  [/Funding Model Reforms|Higher Education Research Systems/i, /Higher Education Research Funding/i],
  [/Community Health Worker|Vaccination Coverage|Antimicrobial Stewardship/i, /Maternal Health Outcomes/i],
  [/Wireless Sensing for Bridge|Bridge Condition/i, /IoT Water Quality Monitoring/i],
  [/Intrusion Detection Models on Campus/i, /RFID-Based Automated Attendance/i],
  [/Student Adoption Patterns in Mobile Payment/i, /Campus Event Management/i],
  [/Rooftop Solar|Solar Panel Performance|Tropical Climates/i, /Solar Panel Performance/i],
  [/Field Performance of Rooftop Solar/i, /Solar Panel Performance/i],
  [/Energy Consumption|Computer Laboratory/i, /Energy Consumption Profiling/i],
  [/Renewable Energy Integration/i, /Renewable Energy Integration/i],
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const pubsCol = db.collection("publications");
  const projectsCol = db.collection("projects");
  const proposalsCol = db.collection("proposals");

  const shellProps = await proposalsCol
    .find({
      $or: [
        { abstract: /linked from publication/i },
        { abstract: /Seeded voluntary proposal for publication/i },
        { researchArea: "Research Outputs" },
      ],
    })
    .toArray();
  const shellPropIds = new Set(shellProps.map((p) => String(p._id)));
  const allProjects = await projectsCol.find({}).toArray();
  const shellProjects = allProjects.filter((p) => shellPropIds.has(String(p.proposalId)));
  const shellIds = new Set(shellProjects.map((p) => String(p._id)));
  const recognized = allProjects.filter((p) => !shellIds.has(String(p._id)));

  const pubs = await pubsCol.find({}).toArray();
  const relinks = [];
  const unmatched = [];

  function pickTarget(pubTitle) {
    for (const [pubRe, projRe] of MAP) {
      if (!pubRe.test(pubTitle || "")) continue;
      // Prefer same-title-ish among matches; first match in recognized list
      const hits = recognized.filter((p) => projRe.test(p.title || ""));
      if (hits.length) return hits[0];
    }
    return null;
  }

  for (const pub of pubs) {
    const currentId = pub.projectId ? String(pub.projectId) : null;
    const onShell = !currentId || shellIds.has(currentId);
    if (!onShell) continue;

    const best = pickTarget(pub.title);
    if (!best) {
      unmatched.push(pub.title);
      continue;
    }

    await pubsCol.updateOne(
      { _id: pub._id },
      { $set: { projectId: best._id, updatedAt: new Date() } }
    );
    relinks.push({
      pub: pub.title,
      toProject: best.title,
      projectId: String(best._id),
    });
  }

  let deletedProjects = 0;
  let deletedProposals = 0;
  for (const sp of shellProjects) {
    const still = await pubsCol.countDocuments({ projectId: sp._id });
    if (still > 0) continue;
    await projectsCol.deleteOne({ _id: sp._id });
    deletedProjects += 1;
    if (sp.proposalId) {
      await proposalsCol.deleteOne({ _id: sp.proposalId });
      deletedProposals += 1;
    }
  }

  const stillOnShell = await pubsCol.countDocuments({
    projectId: { $in: [...shellIds].map((id) => new mongoose.Types.ObjectId(id)) },
  });
  const linkedRecognized = await pubsCol.countDocuments({
    projectId: { $in: recognized.map((p) => p._id) },
  });

  const summary = {
    relinked: relinks.length,
    unmatchedCount: unmatched.length,
    unmatched,
    deletedProjects,
    deletedProposals,
    stillOnShell,
    linkedRecognized,
    relinks,
  };
  log("relink v2 complete", summary);
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

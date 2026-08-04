/**
 * Link every publication without projectId to a research project:
 * 1) Same-title project owned by same researcher → reuse
 * 2) Else create voluntary proposal + active project titled as the publication
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const LOG = path.join(__dirname, "..", "..", "debug-f558f7.log");

function log(hypothesisId, message, data) {
  fs.appendFileSync(
    LOG,
    JSON.stringify({
      sessionId: "f558f7",
      runId: "link-pub-projectId",
      hypothesisId,
      location: "linkOrphanPublicationsToProjects.js",
      message,
      data,
      timestamp: Date.now(),
    }) + "\n"
  );
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL);
  const db = mongoose.connection.db;
  const pubs = db.collection("publications");
  const projects = db.collection("projects");
  const proposals = db.collection("proposals");

  const orphans = await pubs.find({ $or: [{ projectId: null }, { projectId: { $exists: false } }] }).toArray();
  log("L1", "orphan publications before link", { count: orphans.length });

  const actions = [];

  for (const pub of orphans) {
    if (!pub.researcherId) {
      actions.push({ title: pub.title, action: "skip_no_researcher" });
      continue;
    }

    const titleKey = norm(pub.title);
    const mine = await projects.find({ researcherId: pub.researcherId }).toArray();
    let project = mine.find((p) => norm(p.title) === titleKey) || null;

    if (!project) {
      const proposalInsert = await proposals.insertOne({
        title: pub.title,
        abstract:
          pub.abstract ||
          `Voluntary research proposal linked from publication: ${pub.title}`,
        department: "Computer Science",
        researchArea: "Research Outputs",
        researcherId: pub.researcherId,
        status: "approved",
        proposalKind: "voluntary",
        fundingCallId: null,
        requiresEthics: true,
        ethicsStatus: "approved",
        programTier: pub.programTier || "undergraduate",
        version: 1,
        versionHistory: [],
        ethicsComments: [],
        assignedReviewers: [],
        reviewerComments: [],
        submittedAt: pub.createdAt || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const projectInsert = await projects.insertOne({
        title: pub.title,
        proposalId: proposalInsert.insertedId,
        researcherId: pub.researcherId,
        status: "active",
        milestones: [],
        teamMembers: [],
        workPlan: [],
        activities: [],
        communicationLog: [],
        progressReports: [],
        closure: { status: "none" },
        programTier: pub.programTier || "undergraduate",
        startDate: pub.createdAt || new Date(),
        endDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      project = await projects.findOne({ _id: projectInsert.insertedId });
      actions.push({
        title: pub.title,
        action: "created_voluntary_project",
        projectId: String(project._id),
      });
    } else {
      actions.push({
        title: pub.title,
        action: "reused_existing_project",
        projectId: String(project._id),
      });
    }

    await pubs.updateOne(
      { _id: pub._id },
      { $set: { projectId: project._id, updatedAt: new Date() } }
    );
  }

  const remaining = await pubs.countDocuments({
    $or: [{ projectId: null }, { projectId: { $exists: false } }],
  });
  const linked = await pubs.countDocuments({ projectId: { $ne: null } });
  const total = await pubs.countDocuments({});

  const summary = {
    orphansBefore: orphans.length,
    actions,
    remainingOrphans: remaining,
    linked,
    total,
    allLinked: remaining === 0,
  };
  log("L2", "orphan publications after link", summary);
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

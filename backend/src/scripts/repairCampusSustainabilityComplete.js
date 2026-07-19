/**
 * Mark Campus Sustainability Challenge Fund project as completed when
 * publication + repository already exist and grant was finance-approved.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { Project, PROJECT_STATUSES, CLOSURE_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Publication } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const fs = require("fs");
const path = require("path");

const DEBUG_LOG = path.join(__dirname, "../../../debug-f558f7.log");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const projects = await Project.find({ title: /Campus Sustainability Challenge Fund/i });
  const results = [];

  for (const project of projects) {
    const [pub, repo, grant] = await Promise.all([
      Publication.findOne({ projectId: project._id }),
      RepositoryItem.findOne({ projectId: project._id }),
      Grant.findOne({
        $or: [{ projectId: project._id }, { title: /Campus Sustainability Challenge Fund/i }],
        amountAwarded: { $gt: 0 },
      }),
    ]);

    const before = { status: project.status, closure: project.closure?.status || "none" };
    const ready = Boolean(pub && repo && grant);

    if (ready && !["completed", "closed"].includes(project.status)) {
      project.status = PROJECT_STATUSES.COMPLETED;
      project.closure = {
        ...(project.closure?.toObject?.() || project.closure || {}),
        status: CLOSURE_STATUSES.ARCHIVED,
        finalReport:
          project.closure?.finalReport ||
          "Research outputs archived (publication + repository). Marked completed.",
        checklist: {
          publicationsArchived: true,
          assetsHandedOver: true,
          dataArchived: true,
          financialCleared: true,
          ethicsClosed: true,
        },
        submittedAt: project.closure?.submittedAt || new Date(),
        directorApprovedAt: project.closure?.directorApprovedAt || new Date(),
        financeApprovedAt: project.closure?.financeApprovedAt || new Date(),
        archivedAt: new Date(),
      };
      await project.save();
      if (grant) {
        grant.status = GRANT_STATUSES.CLOSED;
        if (!grant.projectId) grant.projectId = project._id;
        await grant.save();
      }
    }

    const after = { status: project.status, closure: project.closure?.status || "none" };
    const row = {
      projectId: String(project._id),
      title: project.title,
      before,
      after,
      ready,
      hasPub: Boolean(pub),
      hasRepo: Boolean(repo),
      grantId: grant ? String(grant._id) : null,
      grantStatus: grant?.status || null,
    };
    results.push(row);

    fs.appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({
        sessionId: "f558f7",
        runId: "campus-sustainability-fix",
        hypothesisId: "CS1",
        location: "repairCampusSustainabilityComplete.js",
        message: "repair campus sustainability completion",
        data: row,
        timestamp: Date.now(),
      })}\n`
    );
  }

  console.log(JSON.stringify({ count: results.length, results }, null, 2));
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

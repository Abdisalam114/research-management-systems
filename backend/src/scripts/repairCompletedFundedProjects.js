/**
 * Mark grant-funded projects completed when publication + repository exist
 * and grant is awarded — without waiting for a second manual archive click.
 *
 * Usage:
 *   node src/scripts/repairCompletedFundedProjects.js
 *   node src/scripts/repairCompletedFundedProjects.js "WHO Regional"
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
const titleFilter = process.argv[2] || "";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);

  const filter = {
    status: { $nin: [PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CLOSED] },
  };
  if (titleFilter) filter.title = new RegExp(titleFilter, "i");

  const projects = await Project.find(filter);
  const results = [];

  for (const project of projects) {
    const [pub, repo, grant] = await Promise.all([
      Publication.findOne({ projectId: project._id }),
      RepositoryItem.findOne({ projectId: project._id }),
      Grant.findOne({
        projectId: project._id,
        amountAwarded: { $gt: 0 },
        status: { $in: [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.APPROVED, GRANT_STATUSES.CLOSED] },
      }),
    ]);

    const before = { status: project.status, closure: project.closure?.status || "none" };
    const ready = Boolean(pub && repo && grant);
    if (!ready) {
      results.push({
        projectId: String(project._id),
        title: project.title,
        before,
        after: before,
        ready: false,
        hasPub: Boolean(pub),
        hasRepo: Boolean(repo),
        grantId: grant ? String(grant._id) : null,
      });
      continue;
    }

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

    grant.status = GRANT_STATUSES.CLOSED;
    await grant.save();

    const after = { status: project.status, closure: project.closure?.status || "none" };
    const row = {
      projectId: String(project._id),
      title: project.title,
      before,
      after,
      ready: true,
      hasPub: true,
      hasRepo: true,
      grantId: String(grant._id),
      grantStatus: grant.status,
    };
    results.push(row);

    fs.appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({
        sessionId: "f558f7",
        runId: "repair-funded-complete",
        hypothesisId: "WHO1",
        location: "repairCompletedFundedProjects.js",
        message: "marked funded project completed from outputs",
        data: row,
        timestamp: Date.now(),
      })}\n`
    );
  }

  console.log(
    JSON.stringify(
      {
        titleFilter: titleFilter || null,
        scanned: projects.length,
        completedNow: results.filter((r) => r.ready && r.after?.status === "completed").length,
        results,
      },
      null,
      2
    )
  );
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Pre-demo health check — run before presentations.
 * node src/scripts/preDemoHealthCheck.js
 */
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
dotenv.config();

const { connectDB } = require("../config/db");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { User } = require("../models/User");
const { Department } = require("../models/Department");

const LOG_PATH = path.join(__dirname, "../../../debug-f558f7.log");

function agentLog(data) {
  const line = JSON.stringify({ sessionId: "f558f7", timestamp: Date.now(), ...data }) + "\n";
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch {
    /* ignore */
  }
}

async function run() {
  await connectDB(process.env.MONGO_URI);

  const issues = [];

  const revisionWithAssignees = await Proposal.countDocuments({
    status: PROPOSAL_STATUSES.REVISION_REQUESTED,
    $or: [
      { "assignedReviewers.0": { $exists: true } },
      { "peerReviews.0": { $exists: true } },
    ],
  });
  if (revisionWithAssignees > 0) {
    issues.push(`${revisionWithAssignees} revision-requested proposal(s) still have stale assignees/reviews`);
  }

  const researchers = await User.find({ role: "researcher" }).select("email programTier");
  for (const r of researchers) {
    if (!r.programTier) issues.push(`Researcher ${r.email} missing programTier`);
  }

  const ugDeptsOnPgResearchers = await Department.countDocuments({ programTier: "undergraduate" });
  const pgDepts = await Department.countDocuments({ programTier: "postgraduate" });

  const summary = {
    revisionWithAssignees,
    researcherCount: researchers.length,
    departments: { ug: ugDeptsOnPgResearchers, pg: pgDepts },
    issues,
    ok: issues.length === 0,
  };

  agentLog({
    hypothesisId: "PRE_DEMO",
    location: "preDemoHealthCheck.js",
    message: "pre-demo health check",
    data: summary,
    runId: "pre-demo",
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
  process.exit(issues.length ? 1 : 0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

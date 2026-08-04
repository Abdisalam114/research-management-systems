/**
 * Runtime checks for last-night bugfixes (assign-first, ethics soft-pass removed, etc.)
 */
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const LOG = path.join(__dirname, "../../.cursor/debug-f558f7.log");

function log(hypothesisId, message, data) {
  const entry = {
    sessionId: "f558f7",
    runId: "bugfix-batch",
    hypothesisId,
    location: "_verify_bugfixes.js",
    message,
    data,
    timestamp: Date.now(),
  };
  console.log(JSON.stringify(entry));
  try {
    fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`);
  } catch {
    /* ignore */
  }
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const {
    isVoluntaryProposal,
    ensureReviewPipeline,
    assertStagesBeforeDirector,
    STAGE_STATUS,
  } = require("../src/utils/proposalReviewPipeline");

  // BF1: ethics soft-pass should not exist in controllers (string scan)
  const proposalCtrl = fs.readFileSync(
    path.join(__dirname, "../src/controllers/proposalController.js"),
    "utf8"
  );
  const ethicsCtrl = fs.readFileSync(
    path.join(__dirname, "../src/controllers/ethicsController.js"),
    "utf8"
  );
  const softPassGone =
    !proposalCtrl.includes("Completed with JUREC ethics approval") &&
    !ethicsCtrl.includes("Completed with JUREC ethics approval");
  log("BF1", "ethics→committee soft-pass removed", { softPassGone });

  // BF2: committeeReview requires assignedCommittee
  const reviewCtrl = fs.readFileSync(
    path.join(__dirname, "../src/controllers/proposalReviewController.js"),
    "utf8"
  );
  log("BF2", "committee assign-first present", {
    hasAssignFirst: reviewCtrl.includes("Assign committee members before committee review"),
    peerNoDirectorAutoComplete: !reviewCtrl.includes(
      "(isDirector && (proposal.peerReviews || []).length > 0)"
    ),
    financeNeedsCommittee: reviewCtrl.includes(
      "Committee must pass before finance review"
    ),
  });

  // BF3: finance link path in ProposalsList
  const listJsx = fs.readFileSync(
    path.join(__dirname, "../../frontend/src/pages/ProposalsList.jsx"),
    "utf8"
  );
  log("BF3", "finance review deep-link", {
    usesFinanceReviewsRoute: listJsx.includes("/finance/reviews/"),
    hasSentToCommitteeChip: listJsx.includes("Sent to committee"),
    hasSentToFinanceChip: listJsx.includes("Sent to finance"),
  });

  // BF4: voluntary helper consistency sample from DB
  const Proposal = mongoose.connection.collection("proposals");
  const samples = await Proposal.find({})
    .project({ proposalKind: 1, fundingCallId: 1, title: 1 })
    .limit(20)
    .toArray();
  const mismatches = samples.filter((p) => {
    const feLike =
      p.proposalKind !== "grant_fund_call" && !p.fundingCallId;
    return feLike !== isVoluntaryProposal(p);
  });
  log("BF4", "voluntary FE/BE alignment", {
    sample: samples.length,
    mismatches: mismatches.length,
  });

  // BF5: assertStagesBeforeDirector still blocks incomplete
  const fake = {
    proposalKind: "voluntary",
    fundingCallId: null,
    reviewPipeline: null,
  };
  ensureReviewPipeline(fake);
  let blocked = false;
  try {
    assertStagesBeforeDirector(fake);
  } catch (e) {
    blocked = true;
  }
  log("BF5", "director approve blocked until stages done", { blocked });

  // BF6: peer route roles
  const routes = fs.readFileSync(
    path.join(__dirname, "../src/routes/proposalRoutes.js"),
    "utf8"
  );
  log("BF6", "peer-review authorizeRoles", {
    ok: /peer-review[\s\S]{0,200}authorizeRoles\("leadership", "research_director"\)/.test(
      routes
    ),
  });

  await mongoose.disconnect();
  process.exit(softPassGone && blocked ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

const STAGE_KEYS = Object.freeze([
  "admin_screening",
  "peer_review",
  "committee_review",
  "finance_review",
]);

const STAGE_STATUS = Object.freeze({
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  PASSED: "passed",
  FAILED: "failed",
  SKIPPED: "skipped",
});

function defaultReviewPipeline() {
  return {
    adminScreening: { status: STAGE_STATUS.PENDING, completedAt: null, completedBy: null, comment: "" },
    peerReview: { status: STAGE_STATUS.PENDING, completedAt: null, reviews: [] },
    committeeReview: { status: STAGE_STATUS.PENDING, completedAt: null, completedBy: null, decision: "", comment: "" },
    financeReview: { status: STAGE_STATUS.PENDING, completedAt: null, completedBy: null, decision: "", comment: "" },
  };
}

function ensureReviewPipeline(proposal) {
  if (!proposal.reviewPipeline || !proposal.reviewPipeline.adminScreening) {
    proposal.reviewPipeline = defaultReviewPipeline();
  }
  return proposal.reviewPipeline;
}

function stagePassed(stage) {
  return stage?.status === STAGE_STATUS.PASSED || stage?.status === STAGE_STATUS.SKIPPED;
}

function assertStagesBeforeDirector(proposal) {
  const p = ensureReviewPipeline(proposal);
  const missing = [];
  if (!stagePassed(p.adminScreening)) missing.push("admin screening");
  if (!stagePassed(p.peerReview)) missing.push("peer review");
  if (!stagePassed(p.committeeReview)) missing.push("committee review");
  if (!stagePassed(p.financeReview)) missing.push("finance review");
  if (missing.length) {
    const err = new Error(`Complete review stages before final approval: ${missing.join(", ")}`);
    err.statusCode = 400;
    throw err;
  }
}

function getCurrentReviewStage(proposal) {
  const p = ensureReviewPipeline(proposal);
  if (!stagePassed(p.adminScreening)) return "admin_screening";
  if (!stagePassed(p.peerReview)) return "peer_review";
  if (!stagePassed(p.committeeReview)) return "committee_review";
  if (!stagePassed(p.financeReview)) return "finance_review";
  return "ready_for_director";
}

module.exports = {
  STAGE_KEYS,
  STAGE_STATUS,
  defaultReviewPipeline,
  ensureReviewPipeline,
  stagePassed,
  assertStagesBeforeDirector,
  getCurrentReviewStage,
};

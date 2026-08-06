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

function defaultReviewPipeline(options = {}) {
  const pipe = {
    adminScreening: { status: STAGE_STATUS.PENDING, completedAt: null, completedBy: null, comment: "" },
    peerReview: { status: STAGE_STATUS.PENDING, completedAt: null, reviews: [] },
    committeeReview: { status: STAGE_STATUS.PENDING, completedAt: null, completedBy: null, decision: "", comment: "" },
    financeReview: { status: STAGE_STATUS.PENDING, completedAt: null, completedBy: null, decision: "", comment: "" },
  };
  if (options.skipFinance) {
    pipe.financeReview = {
      status: STAGE_STATUS.SKIPPED,
      completedAt: new Date(),
      completedBy: null,
      decision: "skipped",
      comment: "Not applicable — voluntary research proposal",
    };
  }
  return pipe;
}

function isVoluntaryProposal(proposal) {
  if (!proposal) return false;
  if (proposal.proposalKind === "grant_fund_call" || proposal.fundingCallId) return false;
  return proposal.proposalKind === "voluntary" || !proposal.fundingCallId;
}

function ensureReviewPipeline(proposal) {
  if (!proposal.reviewPipeline || !proposal.reviewPipeline.adminScreening) {
    proposal.reviewPipeline = defaultReviewPipeline({ skipFinance: isVoluntaryProposal(proposal) });
  } else if (isVoluntaryProposal(proposal) && proposal.reviewPipeline.financeReview?.status === STAGE_STATUS.PENDING) {
    proposal.reviewPipeline.financeReview = {
      status: STAGE_STATUS.SKIPPED,
      completedAt: proposal.reviewPipeline.financeReview.completedAt || new Date(),
      completedBy: null,
      decision: "skipped",
      comment: proposal.reviewPipeline.financeReview.comment || "Not applicable — voluntary research proposal",
    };
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
  if (!isVoluntaryProposal(proposal) && !stagePassed(p.financeReview)) missing.push("finance review");
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
  if (!isVoluntaryProposal(proposal) && !stagePassed(p.financeReview)) return "finance_review";
  return "ready_for_director";
}

/** Proposals still in peer-review workflow (Director + Leadership queues must use the same set). */
const ACTIVE_PEER_REVIEW_STATUSES = Object.freeze([
  "submitted",
  "under_review",
  "revision_requested",
]);

function isActivePeerReviewStatus(status) {
  return ACTIVE_PEER_REVIEW_STATUSES.includes(status);
}

/**
 * Permanent invariant: only active peer-review statuses may keep Leadership assignees.
 * Call before save / whenever status leaves the active queue.
 */
function clearPeerAssigneesIfInactive(proposal) {
  if (!proposal) return false;
  if (isActivePeerReviewStatus(proposal.status)) return false;
  let changed = false;
  if (Array.isArray(proposal.assignedReviewers) && proposal.assignedReviewers.length > 0) {
    proposal.assignedReviewers = [];
    changed = true;
    if (typeof proposal.markModified === "function") proposal.markModified("assignedReviewers");
  }
  if (Array.isArray(proposal.assignedCommittee) && proposal.assignedCommittee.length > 0) {
    proposal.assignedCommittee = [];
    changed = true;
    if (typeof proposal.markModified === "function") proposal.markModified("assignedCommittee");
  }
  if (Array.isArray(proposal.assignedFinance) && proposal.assignedFinance.length > 0) {
    proposal.assignedFinance = [];
    changed = true;
    if (typeof proposal.markModified === "function") proposal.markModified("assignedFinance");
  }
  return changed;
}

/** Mongo filter fragment: proposals sent to reviewers (Director queue). */
function peerReviewSentToReviewersFilter(extra = {}) {
  return {
    "assignedReviewers.0": { $exists: true },
    status: { $in: [...ACTIVE_PEER_REVIEW_STATUSES] },
    ...extra,
  };
}

/** Mongo filter fragment: proposals assigned to a specific Leadership reviewer. */
function peerReviewAssignedToUserFilter(userId, extra = {}) {
  return {
    "assignedReviewers.userId": userId,
    status: { $in: [...ACTIVE_PEER_REVIEW_STATUSES] },
    ...extra,
  };
}

/** Director queue: sent to reviewers OR already has submitted peer reviews (assignees may be cleared after completion). */
function peerReviewDirectorQueueFilter(extra = {}) {
  return {
    status: { $in: [...ACTIVE_PEER_REVIEW_STATUSES] },
    $or: [
      { "assignedReviewers.0": { $exists: true } },
      { "peerReviews.0": { $exists: true } },
    ],
    ...extra,
  };
}

/** Leadership queue: currently assigned OR previously submitted a review on an active proposal. */
function peerReviewLeadershipQueueFilter(userId, extra = {}) {
  return {
    status: { $in: [...ACTIVE_PEER_REVIEW_STATUSES] },
    $or: [
      { "assignedReviewers.userId": userId },
      { "peerReviews.userId": userId },
    ],
    ...extra,
  };
}

const ACTIVE_COMMITTEE_REVIEW_STATUSES = Object.freeze([
  STAGE_STATUS.PENDING,
  STAGE_STATUS.IN_PROGRESS,
]);

/** Coordinator committee queue: assigned while peer review passed and committee stage open. */
function committeeAssignedToUserFilter(userId, extra = {}) {
  return {
    "assignedCommittee.userId": userId,
    status: { $in: [...ACTIVE_PEER_REVIEW_STATUSES] },
    "reviewPipeline.peerReview.status": STAGE_STATUS.PASSED,
    "reviewPipeline.committeeReview.status": { $in: [...ACTIVE_COMMITTEE_REVIEW_STATUSES] },
    ...extra,
  };
}

/** Director view: proposals sent to committee (active pipeline). */
function committeeSentToMembersFilter(extra = {}) {
  return {
    "assignedCommittee.0": { $exists: true },
    status: { $in: [...ACTIVE_PEER_REVIEW_STATUSES] },
    "reviewPipeline.peerReview.status": STAGE_STATUS.PASSED,
    "reviewPipeline.committeeReview.status": { $in: [...ACTIVE_COMMITTEE_REVIEW_STATUSES] },
    ...extra,
  };
}

module.exports = {
  STAGE_KEYS,
  STAGE_STATUS,
  ACTIVE_PEER_REVIEW_STATUSES,
  isActivePeerReviewStatus,
  clearPeerAssigneesIfInactive,
  peerReviewSentToReviewersFilter,
  peerReviewAssignedToUserFilter,
  peerReviewDirectorQueueFilter,
  peerReviewLeadershipQueueFilter,
  ACTIVE_COMMITTEE_REVIEW_STATUSES,
  committeeAssignedToUserFilter,
  committeeSentToMembersFilter,
  defaultReviewPipeline,
  ensureReviewPipeline,
  stagePassed,
  assertStagesBeforeDirector,
  getCurrentReviewStage,
  isVoluntaryProposal,
};

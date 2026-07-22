const { notifyUsersByRole } = require("./notify");
const { Notification } = require("../models/Notification");
const { isVoluntaryProposal, ensureReviewPipeline, STAGE_STATUS } = require("./proposalReviewPipeline");

/**
 * After committee clears, notify Finance Officers for grant-fund proposals
 * awaiting stage-4 finance review. Dedupes within 12 hours per proposal link.
 */
async function notifyFinanceProposalReviewReady(proposal, { force = false } = {}) {
  if (!proposal?._id || isVoluntaryProposal(proposal)) return false;
  const pipe = ensureReviewPipeline(proposal);
  if (pipe.committeeReview?.status !== STAGE_STATUS.PASSED) return false;
  if (
    pipe.financeReview?.status !== STAGE_STATUS.PENDING &&
    pipe.financeReview?.status !== STAGE_STATUS.IN_PROGRESS
  ) {
    return false;
  }

  const link = `/finance/reviews/${proposal._id}`;
  if (!force) {
    const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const recent = await Notification.findOne({
      type: "proposal",
      link,
      createdAt: { $gte: since },
    }).select("_id");
    if (recent) return false;
  }

  await notifyUsersByRole(
    "finance_officer",
    {
      type: "proposal",
      title: "Proposal ready for finance review",
      body: proposal.title,
      link,
    },
    proposal.programTier
  );
  return true;
}

module.exports = { notifyFinanceProposalReviewReady };

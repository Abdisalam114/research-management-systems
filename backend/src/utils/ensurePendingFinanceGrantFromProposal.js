const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { FundingCall } = require("../models/FundingCall");
const { Project } = require("../models/Project");
const { notifyUsersByRole } = require("./notify");

/**
 * After a fund-call proposal is accepted, create (or reuse) a Grant in pending_finance
 * so Finance can approve the money and activate a budget.
 */
async function ensurePendingFinanceGrantFromProposal(proposal, { notify = true } = {}) {
  if (!proposal?._id || !proposal.fundingCallId) {
    return null;
  }

  const existing = await Grant.findOne({
    proposalId: proposal._id,
    callId: proposal.fundingCallId,
  });
  if (existing) {
    // If director already approved the proposal but grant is still draft/submitted, promote to pending_finance
    if (
      proposal.status === "approved" &&
      [GRANT_STATUSES.DRAFT, GRANT_STATUSES.SUBMITTED, GRANT_STATUSES.APPROVED].includes(existing.status)
    ) {
      const call = await FundingCall.findById(proposal.fundingCallId);
      const amount =
        Number(existing.amountAwarded) > 0
          ? Number(existing.amountAwarded)
          : Number(proposal.budgetTotal) > 0
            ? Number(proposal.budgetTotal)
            : Number(existing.amountRequested) > 0
              ? Number(existing.amountRequested)
              : Number(call?.amountCap) || 0;
      existing.status = GRANT_STATUSES.PENDING_FINANCE;
      existing.amountRequested = amount || existing.amountRequested || 0;
      existing.amountAwarded = amount || existing.amountAwarded || 0;
      existing.decidedAt = existing.decidedAt || new Date();
      if (!existing.projectId) {
        const project = await Project.findOne({ proposalId: proposal._id });
        if (project) existing.projectId = project._id;
      }
      await existing.save();
      if (notify) {
        try {
          await notifyUsersByRole(
            "finance_officer",
            {
              type: "grant",
              title: "Funding call award — finance approval needed",
              body: `${existing.title} (${existing.amountAwarded || 0} ${existing.currency})`,
              link: "/finance/grant-approvals",
            },
            proposal.programTier
          );
        } catch {
          /* best-effort */
        }
      }
      return existing;
    }
    return existing;
  }

  if (proposal.status !== "approved") {
    return null;
  }

  const call = await FundingCall.findById(proposal.fundingCallId);
  if (!call) {
    return null;
  }

  const project = await Project.findOne({ proposalId: proposal._id });
  const amount =
    Number(proposal.budgetTotal) > 0
      ? Number(proposal.budgetTotal)
      : Number(call.amountCap) > 0
        ? Number(call.amountCap)
        : 0;

  const grant = await Grant.create({
    title: call.title || proposal.title,
    fundingSource: call.fundingSource || "Funding call",
    donorRef: call.donorRef || "",
    currency: proposal.budgetCurrency || call.currency || "USD",
    amountRequested: amount,
    amountAwarded: amount,
    status: GRANT_STATUSES.PENDING_FINANCE,
    complianceNotes: "Created from accepted funding-call proposal — awaiting finance approval.",
    researcherId: proposal.researcherId,
    projectId: project?._id || null,
    proposalId: proposal._id,
    callId: call._id,
    decidedAt: new Date(),
    programTier: proposal.programTier,
    budgetBreakdown: proposal.budgetBreakdown || [],
    budgetTotal: Number(proposal.budgetTotal) || amount,
  });

  if (notify) {
    try {
      await notifyUsersByRole(
        "finance_officer",
        {
          type: "grant",
          title: "Funding call award — finance approval needed",
          body: `${grant.title} (${amount || 0} ${grant.currency})`,
          link: "/finance/grant-approvals",
        },
        proposal.programTier
      );
    } catch {
      /* best-effort */
    }
  }

  return grant;
}

/** Backfill pending-finance grants for all approved fund-call proposals missing a finance grant. */
async function backfillPendingFinanceGrantsFromProposals(tierWhere = {}) {
  const { Proposal } = require("../models/Proposal");
  const approved = await Proposal.find({
    ...tierWhere,
    status: "approved",
    fundingCallId: { $ne: null },
  }).limit(50);

  const results = [];
  for (const p of approved) {
    const g = await ensurePendingFinanceGrantFromProposal(p, { notify: false });
    if (g) results.push({ proposalId: String(p._id), grantId: String(g._id), status: g.status });
  }
  return results;
}

module.exports = {
  ensurePendingFinanceGrantFromProposal,
  backfillPendingFinanceGrantsFromProposals,
};

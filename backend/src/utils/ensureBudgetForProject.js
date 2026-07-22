const { Budget } = require("../models/Budget");
const { Grant } = require("../models/Grant");
const { Proposal } = require("../models/Proposal");
const { FundingCall } = require("../models/FundingCall");

function pickAmount(...values) {
  for (const v of values) {
    const n = Number(v);
    if (n > 0) return n;
  }
  return 0;
}

/**
 * Auto-create / refresh Budget.totalAllocated when a project exists,
 * using grant award → proposal budget → funding-call cap.
 */
async function ensureBudgetForProject(project, { grant = null, proposal = null } = {}) {
  if (!project?._id) return { budget: null, created: false, updated: false };

  let resolvedGrant = grant;
  if (!resolvedGrant) {
    resolvedGrant = await Grant.findOne({ projectId: project._id }).sort({ updatedAt: -1 });
  }
  if (!resolvedGrant && project.proposalId) {
    resolvedGrant = await Grant.findOne({ proposalId: project.proposalId }).sort({ updatedAt: -1 });
  }

  let resolvedProposal = proposal;
  if (!resolvedProposal && project.proposalId) {
    resolvedProposal = await Proposal.findById(project.proposalId).select(
      "budgetTotal budgetCurrency fundingCallId researcherId programTier"
    );
  }

  let callCap = 0;
  let callCurrency = null;
  const callId = resolvedGrant?.callId || resolvedProposal?.fundingCallId;
  if (callId) {
    const call = await FundingCall.findById(callId).select("amountCap currency");
    callCap = Number(call?.amountCap) || 0;
    callCurrency = call?.currency || null;
  }

  const amount = pickAmount(
    resolvedGrant?.amountAwarded,
    resolvedGrant?.budgetTotal,
    resolvedGrant?.amountRequested,
    resolvedProposal?.budgetTotal,
    callCap
  );
  if (amount <= 0) {
    return { budget: null, created: false, updated: false, amount: 0 };
  }

  const currency =
    resolvedGrant?.currency ||
    resolvedProposal?.budgetCurrency ||
    callCurrency ||
    "USD";
  const ownerResearcherId =
    resolvedGrant?.researcherId ||
    resolvedProposal?.researcherId ||
    project.researcherId;
  const programTier =
    resolvedGrant?.programTier || resolvedProposal?.programTier || project.programTier;

  let budget =
    (await Budget.findOne({ projectId: project._id })) ||
    (resolvedGrant?._id ? await Budget.findOne({ grantId: resolvedGrant._id }) : null);

  if (budget) {
    let changed = false;
    if (Number(budget.totalAllocated || 0) !== amount) {
      // Never reduce a locked allocation; only raise to match award
      if (Number(budget.totalAllocated || 0) > 0 && amount < Number(budget.totalAllocated || 0)) {
        /* keep existing allocated */
      } else {
        budget.totalAllocated = amount;
        changed = true;
      }
    }
    if (String(budget.projectId || "") !== String(project._id)) {
      budget.projectId = project._id;
      changed = true;
    }
    if (resolvedGrant?._id && String(budget.grantId || "") !== String(resolvedGrant._id)) {
      budget.grantId = resolvedGrant._id;
      changed = true;
    }
    if (currency && budget.currency !== currency) {
      budget.currency = currency;
      changed = true;
    }
    if (budget.totalDisbursed == null) {
      budget.totalDisbursed = 0;
      changed = true;
    }
    if (changed) await budget.save();
    return { budget, created: false, updated: changed, amount };
  }

  budget = await Budget.create({
    grantId: resolvedGrant?._id || null,
    projectId: project._id,
    ownerResearcherId,
    programTier,
    totalAllocated: amount,
    totalDisbursed: 0,
    currency,
    items: [],
  });

  return { budget, created: true, updated: false, amount };
}

module.exports = { ensureBudgetForProject };

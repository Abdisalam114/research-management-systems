const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Grant } = require("../models/Grant");
const { Proposal } = require("../models/Proposal");
const { FundingCall } = require("../models/FundingCall");
const { ensurePendingFinanceGrantFromProposal } = require("./ensurePendingFinanceGrantFromProposal");
const { ensureBudgetForProject } = require("./ensureBudgetForProject");
const { ensureBudgetForGrant } = require("./ensureBudgetForGrant");

function idOf(doc) {
  if (!doc) return null;
  const raw = doc._id || doc.id || doc;
  return raw ? String(raw) : null;
}

function summarizeChain({ call, proposal, grant, project, budget, created = {} }) {
  const parts = [];
  if (call) parts.push("funding call");
  if (proposal) parts.push("proposal");
  if (grant) parts.push("grant");
  if (project) parts.push("project");
  if (budget) parts.push("budget");
  const linked = parts.length
    ? `Automatically linked: ${parts.join(" → ")}.`
    : "Accepted.";
  return {
    linked: true,
    message: linked,
    created,
    ids: {
      callId: idOf(call),
      proposalId: idOf(proposal),
      grantId: idOf(grant),
      projectId: idOf(project),
      budgetId: idOf(budget),
    },
    titles: {
      call: call?.title || null,
      proposal: proposal?.title || null,
      grant: grant?.title || null,
      project: project?.title || null,
    },
  };
}

/**
 * After a funding-call award is accepted, wire call ↔ proposal ↔ grant ↔ project ↔ budget
 * so nothing is left as a dangling record.
 */
async function linkFundCallAwardChain({ proposal, grant = null, programTier } = {}) {
  let resolvedProposal = proposal;
  if (!resolvedProposal && grant?.proposalId) {
    resolvedProposal = await Proposal.findById(grant.proposalId);
  }
  if (!resolvedProposal && !grant) return null;

  const callId = resolvedProposal?.fundingCallId || grant?.callId;
  if (!callId) return null;

  const call = await FundingCall.findById(callId);
  const researcherId = resolvedProposal?.researcherId || grant?.researcherId;
  const tier = programTier || resolvedProposal?.programTier || grant?.programTier || call?.programTier;

  let project =
    (resolvedProposal?._id ? await Project.findOne({ proposalId: resolvedProposal._id }) : null) ||
    (grant?.projectId ? await Project.findById(grant.projectId) : null);

  const created = { project: false, grant: false, budget: false };

  if (!project && resolvedProposal && researcherId && tier) {
    project = await Project.create({
      proposalId: resolvedProposal._id,
      title: resolvedProposal.title,
      researcherId,
      programTier: tier,
      teamMembers: [],
      milestones: [],
      status: PROJECT_STATUSES.ACTIVE,
      progressReports: [],
    });
    created.project = true;
  }

  let resolvedGrant = grant;
  if (!resolvedGrant && resolvedProposal) {
    const before = await Grant.findOne({
      proposalId: resolvedProposal._id,
      callId,
    });
    resolvedGrant = await ensurePendingFinanceGrantFromProposal(resolvedProposal, { notify: false });
    created.grant = Boolean(resolvedGrant && !before);
  }

  if (resolvedGrant && project && String(resolvedGrant.projectId || "") !== String(project._id)) {
    resolvedGrant.projectId = project._id;
    await resolvedGrant.save();
  }

  let budgetResult = null;
  if (project) {
    budgetResult = await ensureBudgetForProject(project, {
      grant: resolvedGrant,
      proposal: resolvedProposal,
    });
  }
  if (!budgetResult?.budget && resolvedGrant) {
    budgetResult = await ensureBudgetForGrant(resolvedGrant);
  }
  created.budget = Boolean(budgetResult?.created);

  if (call) {
    try {
      const { closeCallAfterGrantAccepted } = require("./fundingCallAutoClose");
      await closeCallAfterGrantAccepted(call._id, {
        programTier: tier,
        grantTitle: resolvedGrant?.title || resolvedProposal?.title,
      });
    } catch {
      /* best-effort */
    }
  }

  return {
    call,
    proposal: resolvedProposal,
    grant: resolvedGrant,
    project,
    budget: budgetResult?.budget || null,
    created,
    summary: summarizeChain({
      call,
      proposal: resolvedProposal,
      grant: resolvedGrant,
      project,
      budget: budgetResult?.budget,
      created,
    }),
  };
}

module.exports = { linkFundCallAwardChain, summarizeChain };

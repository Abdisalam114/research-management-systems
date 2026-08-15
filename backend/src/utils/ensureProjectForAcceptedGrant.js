const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Proposal, ETHICS_STATUSES } = require("../models/Proposal");

function looksLikeFundingAwardTitle(title) {
  const t = String(title || "").trim();
  if (!t) return true;
  return /\b(fund|grant|award|fellowship|scholarship|challenge|call|seed)\b/i.test(t);
}

/**
 * Link an accepted grant to a real research Project (Open / active).
 * Prefer the linked proposal. Never invent a project from the funding-call name alone.
 */
async function ensureProjectForAcceptedGrant(grant, { programTier } = {}) {
  if (!grant?._id) return null;

  if (grant.projectId) {
    const existing = await Project.findById(grant.projectId);
    if (existing) {
      const fakeShell = !existing.proposalId && looksLikeFundingAwardTitle(existing.title);
      if (!fakeShell || !grant.proposalId) {
        return { project: existing, created: false, linked: false };
      }
    }
  }

  if (grant.proposalId) {
    const byProposal = await Project.findOne({ proposalId: grant.proposalId });
    if (byProposal) {
      grant.projectId = byProposal._id;
      await grant.save();
      return { project: byProposal, created: false, linked: true };
    }

    const proposal = await Proposal.findById(grant.proposalId).select(
      "title ethicsStatus researcherId programTier"
    );
    const tier = programTier || grant.programTier || proposal?.programTier;
    if (proposal?.title && tier) {
      const ethicsApproved = proposal.ethicsStatus === ETHICS_STATUSES.APPROVED;
      const project = await Project.create({
        proposalId: proposal._id,
        title: proposal.title,
        researcherId: proposal.researcherId || grant.researcherId,
        teamMembers: [],
        milestones: [
          { title: "Ethics clearance", dueDate: null, completed: ethicsApproved },
          { title: "Mid-term review", dueDate: null, completed: false },
          { title: "Final report", dueDate: null, completed: false },
        ],
        status: PROJECT_STATUSES.ACTIVE,
        progressReports: [],
        programTier: tier,
      });
      grant.projectId = project._id;
      await grant.save();
      return { project, created: true, linked: true };
    }
  }

  return null;
}

/** Chain funding records, then always fall back to an Open project from the proposal. */
async function attachOpenProjectOnGrantAccept(grant, req) {
  let fundCallLinks = null;
  let projectResult = null;
  let budgetResult = null;
  try {
    if (grant.callId || grant.proposalId) {
      const { linkFundCallAwardChain } = require("./linkFundCallAwardChain");
      const chain = await linkFundCallAwardChain({
        grant,
        programTier: grant.programTier || req.programTier,
      });
      fundCallLinks = chain?.summary || null;
      if (chain?.project) {
        projectResult = { project: chain.project, created: chain.created?.project };
      }
      if (chain?.budget) {
        budgetResult = { budget: chain.budget, created: chain.created?.budget };
      }
    }
  } catch (err) {
    fundCallLinks = {
      message: err.message || "Funding-call link incomplete.",
    };
  }
  if (!projectResult?.project) {
    projectResult = await ensureProjectForAcceptedGrant(grant, {
      programTier: grant.programTier || req.programTier,
    });
  }
  return { fundCallLinks, projectResult, budgetResult };
}

module.exports = {
  ensureProjectForAcceptedGrant,
  attachOpenProjectOnGrantAccept,
  looksLikeFundingAwardTitle,
};

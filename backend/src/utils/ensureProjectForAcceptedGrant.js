const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Proposal, ETHICS_STATUSES } = require("../models/Proposal");

function looksLikeFundingAwardTitle(title) {
  const t = String(title || "").trim();
  if (!t) return true;
  return /\b(fund|grant|award|fellowship|scholarship|challenge|call|seed)\b/i.test(t);
}

/**
 * Link an accepted grant to a real research Project.
 * Never invent a Project from a funding-call / grant name alone.
 */
async function ensureProjectForAcceptedGrant(grant, { programTier } = {}) {
  if (!grant?._id) return null;

  if (grant.projectId) {
    const existing = await Project.findById(grant.projectId);
    if (existing) {
      // Drop link if the "project" is only a fake funding-named shell
      if (!existing.proposalId && looksLikeFundingAwardTitle(existing.title)) {
      } else {
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

    // Create project from the real proposal title (research work), not the call name
    const proposal = await Proposal.findById(grant.proposalId).select(
      "title ethicsStatus researcherId programTier"
    );
    if (proposal?.title && !looksLikeFundingAwardTitle(proposal.title)) {
      const ethicsApproved = proposal.ethicsStatus === ETHICS_STATUSES.APPROVED;
      const tier = programTier || grant.programTier || proposal.programTier;
      if (!tier) {
        return null;
      }
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

  // No real research project available — leave grant without inventing a fake project
  grant.projectId = null;
  await grant.save();
  return null;
}

module.exports = { ensureProjectForAcceptedGrant, looksLikeFundingAwardTitle };

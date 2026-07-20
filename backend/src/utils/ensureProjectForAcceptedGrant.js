const fs = require("fs");
const path = require("path");
const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Proposal, ETHICS_STATUSES } = require("../models/Proposal");

const DEBUG_LOG = path.join(__dirname, "../../../debug-f558f7.log");

function debugLog(message, data, hypothesisId = "G1") {
  // #region agent log
  try {
    fs.appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({
        sessionId: "f558f7",
        runId: "grant-to-project",
        hypothesisId,
        location: "ensureProjectForAcceptedGrant.js",
        message,
        data,
        timestamp: Date.now(),
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion
}

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
        debugLog("reject fake funding-named project link", {
          grantId: String(grant._id),
          projectId: String(existing._id),
          title: existing.title,
        }, "G0");
      } else {
        debugLog("reuse existing grant.projectId", {
          grantId: String(grant._id),
          projectId: String(existing._id),
          created: false,
        }, "G1");
        return { project: existing, created: false, linked: false };
      }
    }
  }

  if (grant.proposalId) {
    const byProposal = await Project.findOne({ proposalId: grant.proposalId });
    if (byProposal) {
      grant.projectId = byProposal._id;
      await grant.save();
      debugLog("linked grant to project via proposalId", {
        grantId: String(grant._id),
        projectId: String(byProposal._id),
        proposalId: String(grant.proposalId),
        created: false,
      }, "G2");
      return { project: byProposal, created: false, linked: true };
    }

    // Create project from the real proposal title (research work), not the call name
    const proposal = await Proposal.findById(grant.proposalId).select(
      "title ethicsStatus researcherId programTier"
    );
    if (proposal?.title && !looksLikeFundingAwardTitle(proposal.title)) {
      const ethicsApproved = proposal.ethicsStatus === ETHICS_STATUSES.APPROVED;
      const tier = programTier || grant.programTier || proposal.programTier;
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
      debugLog("created project from proposal (not grant title)", {
        grantId: String(grant._id),
        projectId: String(project._id),
        title: project.title,
        created: true,
      }, "G3");
      return { project, created: true, linked: true };
    }
  }

  // No real research project available — leave grant without inventing a fake project
  grant.projectId = null;
  await grant.save();
  debugLog("skip create — no proposal/research project (will not invent funding-named project)", {
    grantId: String(grant._id),
    grantTitle: grant.title,
    hadProposalId: Boolean(grant.proposalId),
  }, "G4");
  return null;
}

module.exports = { ensureProjectForAcceptedGrant, looksLikeFundingAwardTitle };

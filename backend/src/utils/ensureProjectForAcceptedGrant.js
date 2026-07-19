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

/**
 * When a grant is accepted (director → pending_finance, or finance → active),
 * ensure it has a Project so it appears under Projects — not only Grants.
 */
async function ensureProjectForAcceptedGrant(grant, { programTier } = {}) {
  if (!grant?._id) return null;

  if (grant.projectId) {
    const existing = await Project.findById(grant.projectId);
    if (existing) {
      debugLog("reuse existing grant.projectId", {
        grantId: String(grant._id),
        projectId: String(existing._id),
        created: false,
      }, "G1");
      return { project: existing, created: false, linked: false };
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
  }

  let title = grant.title;
  let ethicsApproved = false;
  if (grant.proposalId) {
    const proposal = await Proposal.findById(grant.proposalId).select("title ethicsStatus");
    if (proposal?.title) title = proposal.title;
    ethicsApproved = proposal?.ethicsStatus === ETHICS_STATUSES.APPROVED;
  }

  const tier = programTier || grant.programTier;
  const project = await Project.create({
    proposalId: grant.proposalId || undefined,
    title: title || "Funded research project",
    researcherId: grant.researcherId,
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

  debugLog("created project for accepted grant", {
    grantId: String(grant._id),
    projectId: String(project._id),
    title: project.title,
    hadProposalId: Boolean(grant.proposalId),
    created: true,
  }, "G3");

  return { project, created: true, linked: true };
}

module.exports = { ensureProjectForAcceptedGrant };

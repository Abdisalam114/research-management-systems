const { Project, PROJECT_STATUSES, CLOSURE_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Publication, PUBLICATION_STATUSES, WORKFLOW_STAGES } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const { Proposal, PROPOSAL_KINDS } = require("../models/Proposal");

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Project title vs output title — exact or contained (UG/PG: "CPU Scheduling" / "CPU Scheduling output test"). */
function titlesAlign(projectTitle, pubTitle) {
  const a = normalize(projectTitle);
  const b = normalize(pubTitle);
  if (!a || !b) return false;
  if (a === b) return true;
  return b.includes(a) || a.includes(b);
}

function isFundingNamedTitle(title) {
  return /\b(fund|grant|award|fellowship|scholarship|challenge|call|seed)\b/i.test(title || "");
}

function publicationLooksFinished(pub) {
  if (!pub) return false;
  if (pub.status === PUBLICATION_STATUSES.VALIDATED) return true;
  if (pub.workflowStage === WORKFLOW_STAGES.PUBLISHED) return true;
  return false;
}

async function markProjectCompleted(project, finalReport) {
  project.status = PROJECT_STATUSES.COMPLETED;
  project.closure = {
    ...(project.closure?.toObject?.() || project.closure || {}),
    status: CLOSURE_STATUSES.ARCHIVED,
    finalReport: project.closure?.finalReport || finalReport,
    checklist: {
      publicationsArchived: true,
      assetsHandedOver: true,
      dataArchived: true,
      financialCleared: true,
      ethicsClosed: true,
    },
    submittedAt: project.closure?.submittedAt || new Date(),
    directorApprovedAt: project.closure?.directorApprovedAt || new Date(),
    financeApprovedAt: project.closure?.financeApprovedAt || new Date(),
    archivedAt: new Date(),
  };
  await project.save();
}

/**
 * Careful auto-complete:
 * - Always requires: finished publication + repository archive + matching titles
 * - Funded also requires awarded grant
 */
async function maybeCompleteFundedProject(projectId) {
  if (!projectId) return null;
  const project = await Project.findById(projectId);
  if (!project) return null;
  if ([PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CLOSED].includes(project.status)) {
    return { skipped: true, reason: "already_completed" };
  }

  const [pub, repo, grant, proposal] = await Promise.all([
    Publication.findOne({ projectId: project._id }).sort({ updatedAt: -1 }),
    RepositoryItem.findOne({ projectId: project._id }),
    Grant.findOne({
      projectId: project._id,
      amountAwarded: { $gt: 0 },
      status: {
        $in: [
          GRANT_STATUSES.ACTIVE,
          GRANT_STATUSES.APPROVED,
          GRANT_STATUSES.CLOSED,
          GRANT_STATUSES.PENDING_FINANCE,
        ],
      },
    }),
    project.proposalId ? Proposal.findById(project.proposalId).select("proposalKind fundingCallId") : null,
  ]);

  const isVoluntary =
    !grant &&
    (proposal?.proposalKind === PROPOSAL_KINDS.VOLUNTARY ||
      (!proposal?.fundingCallId && proposal?.proposalKind !== PROPOSAL_KINDS.GRANT_FUND_CALL) ||
      !proposal);

  // Repository is required for ALL project completion (funded + voluntary)
  if (!repo) {
    return { skipped: true, reason: "repository_required" };
  }

  // --- Voluntary: publication finished + repository + matching title ---
  if (isVoluntary) {
    if (!publicationLooksFinished(pub)) {
      return { skipped: true, reason: "voluntary_pub_not_finished" };
    }
    if (isFundingNamedTitle(project.title)) {
      return { skipped: true, reason: "funding_named_project_blocked" };
    }
    if (!titlesAlign(project.title, pub.title)) {
      return { skipped: true, reason: "voluntary_title_mismatch" };
    }

    await markProjectCompleted(
      project,
      "Auto-completed after publication and repository archive for this voluntary project."
    );
    return { completed: true, kind: "voluntary", projectId: String(project._id) };
  }

  // --- Funded: pub + repo + awarded grant + matching project/output title ---
  if (!pub || !grant) {
    return { skipped: true, reason: "missing_outputs_or_grant" };
  }
  if (isFundingNamedTitle(project.title)) {
    return { skipped: true, reason: "funding_named_project_blocked" };
  }
  if (!publicationLooksFinished(pub)) {
    return { skipped: true, reason: "publication_not_finished" };
  }
  // Match research output title to project (grant/call title is often the seed fund name)
  if (!titlesAlign(project.title, pub.title)) {
    return { skipped: true, reason: "title_mismatch_project_pub" };
  }

  await markProjectCompleted(
    project,
    "Auto-completed after publication and repository archive for this funded award."
  );

  if (grant.status !== GRANT_STATUSES.CLOSED) {
    grant.status = GRANT_STATUSES.CLOSED;
    await grant.save();
  }

  return { completed: true, kind: "funded", projectId: String(project._id), grantId: String(grant._id) };
}

module.exports = { maybeCompleteFundedProject };

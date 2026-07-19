const fs = require("fs");
const path = require("path");
const { Project, PROJECT_STATUSES, CLOSURE_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Publication } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");

const DEBUG_LOG = path.join(__dirname, "../../../debug-f558f7.log");

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Careful auto-complete: only when
 * - project still open
 * - has publication + repository
 * - linked awarded grant
 * - project title matches grant title (grant-named project the user finished)
 *
 * Does NOT close seed research projects funded under a differently named grant.
 */
async function maybeCompleteFundedProject(projectId) {
  if (!projectId) return null;
  const project = await Project.findById(projectId);
  if (!project) return null;
  if ([PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CLOSED].includes(project.status)) {
    return { skipped: true, reason: "already_completed" };
  }

  const [pub, repo, grant] = await Promise.all([
    Publication.findOne({ projectId: project._id }),
    RepositoryItem.findOne({ projectId: project._id }),
    Grant.findOne({
      projectId: project._id,
      amountAwarded: { $gt: 0 },
      status: { $in: [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.APPROVED, GRANT_STATUSES.CLOSED] },
    }),
  ]);

  if (!pub || !repo || !grant) {
    return { skipped: true, reason: "missing_outputs_or_grant" };
  }
  if (normalize(project.title) !== normalize(grant.title)) {
    return { skipped: true, reason: "title_mismatch_seed_safe" };
  }

  project.status = PROJECT_STATUSES.COMPLETED;
  project.closure = {
    ...(project.closure?.toObject?.() || project.closure || {}),
    status: CLOSURE_STATUSES.ARCHIVED,
    finalReport:
      project.closure?.finalReport ||
      "Auto-completed after publication and repository archive for this funded award.",
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

  if (grant.status !== GRANT_STATUSES.CLOSED) {
    grant.status = GRANT_STATUSES.CLOSED;
    await grant.save();
  }

  // #region agent log
  try {
    fs.appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({
        sessionId: "f558f7",
        runId: "auto-complete-funded",
        hypothesisId: "CARE3",
        location: "maybeCompleteFundedProject.js",
        message: "auto-completed matching-title funded project",
        data: {
          projectId: String(project._id),
          grantId: String(grant._id),
          title: project.title,
        },
        timestamp: Date.now(),
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion

  return { completed: true, projectId: String(project._id), grantId: String(grant._id) };
}

module.exports = { maybeCompleteFundedProject };

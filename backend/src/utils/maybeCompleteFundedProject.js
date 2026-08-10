const { Project, PROJECT_STATUSES } = require("../models/Project");

/**
 * Projects never auto-complete when publication/repository are done.
 * Closure must be submitted and approved (Director; Finance for grant-funded).
 */
async function maybeCompleteFundedProject(projectId) {
  if (!projectId) return null;
  const project = await Project.findById(projectId);
  if (!project) return null;
  if ([PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CLOSED].includes(project.status)) {
    return { skipped: true, reason: "already_completed" };
  }
  return { skipped: true, reason: "director_closure_required" };
}

module.exports = { maybeCompleteFundedProject };

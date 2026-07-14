const { Project } = require("../models/Project");
const { PUBLICATION_STATUSES } = require("../models/Publication");
const { notifyUsersByRole } = require("./notify");
const { recordAudit } = require("./audit");

function isSubmittedOrBetter(status) {
  return status === PUBLICATION_STATUSES.SUBMITTED || status === PUBLICATION_STATUSES.VALIDATED;
}

/**
 * After a publication is submitted (or created+submitted), refresh related
 * system surfaces: notifications, audit, project activity log.
 * Workflow / awards / analytics recompute from DB on next read.
 */
async function afterPublicationSubmitted(req, pub) {
  const projectId = pub.projectId?._id || pub.projectId || null;
  const programTier = req.programTier || null;
  const effects = {
    notifiedCoordinator: false,
    notifiedDirector: false,
    projectLogUpdated: false,
    auditRecorded: false,
    projectId: projectId ? String(projectId) : null,
    pubStatus: pub.status,
  };

  try {
    await notifyUsersByRole(
      "faculty_coordinator",
      {
        type: "publication",
        title: "Publication submitted for validation",
        body: pub.title,
        link: "/publications",
      },
      programTier
    );
    effects.notifiedCoordinator = true;
  } catch {
    /* best-effort */
  }

  try {
    await notifyUsersByRole(
      "research_director",
      {
        type: "publication",
        title: "Publication submitted — project workflow updated",
        body: pub.title,
        link: projectId ? `/projects/${projectId}` : "/publications",
      },
      programTier
    );
    effects.notifiedDirector = true;
  } catch {
    /* best-effort */
  }

  if (projectId && req.user?.id) {
    try {
      await Project.findByIdAndUpdate(projectId, {
        $push: {
          communicationLog: {
            type: "note",
            subject: "Publication submitted",
            body: `Research output submitted: ${pub.title}`,
            loggedBy: req.user.id,
            loggedAt: new Date(),
          },
        },
      });
      effects.projectLogUpdated = true;
    } catch {
      /* best-effort */
    }
  }

  try {
    await recordAudit({
      entityType: "publication",
      entityId: pub._id,
      action: "submitted",
      label: "Publication submitted",
      detail: pub.title,
      actorId: req.user?.id || null,
      actorRole: req.user?.role || "",
      metadata: {
        projectId: projectId ? String(projectId) : null,
        status: pub.status,
        workflowStage: pub.workflowStage || null,
      },
      programTier,
    });
    effects.auditRecorded = true;
  } catch {
    /* best-effort */
  }

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    fs.appendFileSync(
      path.join(process.cwd(), "..", ".cursor", "debug-f558f7.log"),
      `${JSON.stringify({
        sessionId: "f558f7",
        hypothesisId: "Q1",
        location: "publicationSideEffects.js:afterPublicationSubmitted",
        message: "publication cascade side effects",
        data: effects,
        timestamp: Date.now(),
        runId: "post-fix",
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion

  return effects;
}

module.exports = {
  afterPublicationSubmitted,
  isSubmittedOrBetter,
};

const { Project } = require("../models/Project");
const { PUBLICATION_STATUSES } = require("../models/Publication");
const { notifyUser, notifyUsersByRole } = require("./notify");
const { recordAudit } = require("./audit");

function isSubmittedOrBetter(status) {
  return (
    status === PUBLICATION_STATUSES.SUBMITTED ||
    status === PUBLICATION_STATUSES.VALIDATED ||
    status === PUBLICATION_STATUSES.REVISION_REQUESTED
  );
}

function projectLink(projectId) {
  return projectId ? `/projects/${projectId}#project-outputs` : "/publications";
}

function pubProjectId(pub) {
  return pub.projectId?._id || pub.projectId || null;
}

/** Append a note/decision to the linked project's communication log. */
async function logPublicationOnProject(projectId, req, { subject, body, type = "note" }) {
  if (!projectId || !req.user?.id) return false;
  try {
    await Project.findByIdAndUpdate(projectId, {
      $push: {
        communicationLog: {
          type,
          subject: String(subject || "").slice(0, 200),
          body: String(body || "").slice(0, 4000),
          loggedBy: req.user.id,
          loggedAt: new Date(),
        },
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Notify researcher + staff and mirror activity onto the project.
 * link always points at the project outputs section when possible.
 */
async function notifyPublicationEvent(req, pub, { title, body, alsoNotifyRoles = [], notifyOwner = true, logType = "decision" }) {
  const projectId = pubProjectId(pub);
  const link = projectLink(projectId);
  const programTier = req.programTier || null;
  const effects = { notifiedOwner: false, notifiedRoles: [], projectLogUpdated: false, link };

  if (notifyOwner && pub.researcherId) {
    const ownerId = pub.researcherId._id || pub.researcherId;
    // Don't notify the actor about their own action
    if (String(ownerId) !== String(req.user?.id)) {
      try {
        await notifyUser(ownerId, {
          type: "publication",
          title,
          body,
          link,
          programTier,
        });
        effects.notifiedOwner = true;
      } catch {
        /* best-effort */
      }
    }
  }

  for (const role of alsoNotifyRoles) {
    try {
      await notifyUsersByRole(
        role,
        {
          type: "publication",
          title,
          body,
          link,
          programTier,
        },
        programTier
      );
      effects.notifiedRoles.push(role);
    } catch {
      /* best-effort */
    }
  }

  effects.projectLogUpdated = await logPublicationOnProject(projectId, req, {
    subject: title,
    body: `${body}\n\nPublication: ${pub.title}`,
    type: logType,
  });

  return effects;
}

/**
 * After a publication is submitted (or created+submitted), refresh related
 * system surfaces: notifications, audit, project activity log.
 */
async function afterPublicationSubmitted(req, pub) {
  const projectId = pubProjectId(pub);
  const programTier = req.programTier || null;
  const effects = {
    notifiedCoordinator: false,
    notifiedDirector: false,
    projectLogUpdated: false,
    auditRecorded: false,
    projectId: projectId ? String(projectId) : null,
    pubStatus: pub.status,
  };

  const notify = await notifyPublicationEvent(req, pub, {
    title: "Publication submitted for review",
    body: `${pub.title} — open the project to see full details and comments.`,
    alsoNotifyRoles: ["faculty_coordinator", "research_director"],
    notifyOwner: false,
  });
  effects.notifiedCoordinator = notify.notifiedRoles.includes("faculty_coordinator");
  effects.notifiedDirector = notify.notifiedRoles.includes("research_director");
  effects.projectLogUpdated = notify.projectLogUpdated;

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
  return effects;
}

/** After Accept / Revise / Reject decision. */
async function afterPublicationDecision(req, pub, { decisionLabel, comment }) {
  return notifyPublicationEvent(req, pub, {
    title: `Publication ${decisionLabel}`,
    body: `${pub.title}: ${String(comment || "").trim().slice(0, 300)}`,
    alsoNotifyRoles: [],
    notifyOwner: true,
  });
}

/** After a free-text review comment. */
async function afterPublicationComment(req, pub, comment) {
  const isOwner = String(pub.researcherId?._id || pub.researcherId) === String(req.user?.id);
  const roles = isOwner ? ["faculty_coordinator", "research_director"] : [];
  return notifyPublicationEvent(req, pub, {
    title: isOwner ? "Researcher commented on publication" : "New review comment on publication",
    body: `${pub.title}: ${String(comment || "").trim().slice(0, 300)}`,
    alsoNotifyRoles: roles,
    notifyOwner: !isOwner,
    logType: "note",
  });
}

module.exports = {
  afterPublicationSubmitted,
  afterPublicationDecision,
  afterPublicationComment,
  logPublicationOnProject,
  projectLink,
  notifyPublicationEvent,
  isSubmittedOrBetter,
};

const { Project } = require("../models/Project");
const { Publication, PUBLICATION_STATUSES, PUBLICATION_TYPE_LABELS, WORKFLOW_STAGES } = require("../models/Publication");
const { notifyUser, notifyUsersByRole } = require("./notify");
const { recordAudit } = require("./audit");
const { workflowStageLabel, resolveWorkflowStage } = require("./publicationWorkflow");

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

function researcherDisplay(pub, req) {
  const r = pub.researcherId;
  if (r && typeof r === "object") {
    const name = r.fullName || r.email || "Researcher";
    const dept = r.department ? ` (${r.department})` : "";
    const email = r.email ? `\nEmail: ${r.email}` : "";
    return `${name}${dept}${email}`;
  }
  if (req?.user?.fullName) {
    return `${req.user.fullName}${req.user.department ? ` (${req.user.department})` : ""}${
      req.user.email ? `\nEmail: ${req.user.email}` : ""
    }`;
  }
  return "Researcher";
}

function projectDisplay(pub) {
  const p = pub.projectId;
  if (p && typeof p === "object") {
    const bits = [p.title || "Linked project"];
    if (p.status) bits.push(`status: ${p.status}`);
    if (p.department) bits.push(`dept: ${p.department}`);
    return bits.join(" · ");
  }
  return pubProjectId(pub) ? String(pubProjectId(pub)) : "—";
}

function line(label, value) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return `${label}: ${v}`;
}

/** Readable summary staff can review from the notification list without opening the module. */
function buildPublicationSubmitNotificationBody(pub, req) {
  const typeLabel = PUBLICATION_TYPE_LABELS[pub.type] || pub.type || "—";
  const authors = Array.isArray(pub.authors) ? pub.authors.filter(Boolean).join(", ") : "";
  const stage = resolveWorkflowStage(pub);
  const rows = [
    "A researcher submitted a research output for institutional review.",
    "",
    line("Title", pub.title),
    line("Type", typeLabel),
    line("Year", pub.year),
    line("Venue", pub.venue),
    line("Authors", authors),
    line("Researcher", researcherDisplay(pub, req).replace(/\n/g, " · ")),
    line("Project", projectDisplay(pub)),
    line("Status", pub.status || PUBLICATION_STATUSES.SUBMITTED),
    line("Workflow stage", workflowStageLabel(stage)),
  ];
  if (pub.communityImpact?.trim()) {
    const impact = String(pub.communityImpact).trim();
    rows.push(line("Community impact", impact.length > 400 ? `${impact.slice(0, 397)}…` : impact));
  }
  rows.push("", "Use Open below when you are ready to review inside the project.");
  return rows.filter((r) => r !== null).join("\n");
}

async function loadPublicationForNotification(pub) {
  const id = pub._id || pub.id;
  if (!id) return pub;
  const populated = await Publication.findById(id)
    .populate("researcherId", "fullName email department")
    .populate("projectId", "title status department");
  return populated || pub;
}

/** Append a note/decision to the linked project's communication log. */
async function logPublicationOnProject(projectId, req, { subject, body, type = "note" }) {
  if (!projectId || !req.user?.id) return false;
  try {
    const filter = { _id: projectId };
    const updated = await Project.findOneAndUpdate(
      filter,
      {
        $push: {
          communicationLog: {
            type,
            subject: String(subject || "").slice(0, 200),
            body: String(body || "").slice(0, 4000),
            loggedBy: req.user.id,
            loggedAt: new Date(),
          },
        },
      },
      { new: true }
    );
    return Boolean(updated);
  } catch {
    return false;
  }
}

/**
 * Notify researcher + staff and mirror activity onto the project.
 * link always points at the project outputs section when possible.
 */
async function notifyPublicationEvent(req, pub, { title, body, alsoNotifyRoles = [], notifyOwner = true, logType = "decision", downloadLink = "" }) {
  const projectId = pubProjectId(pub);
  const link = projectLink(projectId);
  const programTier = req.programTier || pub.programTier || null;
  const resolvedDownload = downloadLink || "";
  const effects = { notifiedOwner: false, notifiedRoles: [], projectLogUpdated: false, link, downloadLink: resolvedDownload };

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
          downloadLink: resolvedDownload,
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
          downloadLink: resolvedDownload,
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
  const enriched = await loadPublicationForNotification(pub);
  const projectId = pubProjectId(enriched);
  const programTier = req.programTier || null;
  const notificationBody = buildPublicationSubmitNotificationBody(enriched, req);
  const effects = {
    notifiedCoordinator: false,
    notifiedDirector: false,
    projectLogUpdated: false,
    auditRecorded: false,
    projectId: projectId ? String(projectId) : null,
    pubStatus: enriched.status,
  };

  const notify = await notifyPublicationEvent(req, enriched, {
    title: `Publication submitted — ${enriched.title || "Research output"}`,
    body: notificationBody,
    alsoNotifyRoles: ["faculty_coordinator", "research_director"],
    notifyOwner: false,
  });
  effects.notifiedCoordinator = notify.notifiedRoles.includes("faculty_coordinator");
  effects.notifiedDirector = notify.notifiedRoles.includes("research_director");
  effects.projectLogUpdated = notify.projectLogUpdated;

  try {
    await recordAudit({
      entityType: "publication",
      entityId: enriched._id,
      action: "submitted",
      label: "Publication submitted",
      detail: enriched.title,
      actorId: req.user?.id || null,
      actorRole: req.user?.role || "",
      metadata: {
        projectId: projectId ? String(projectId) : null,
        status: enriched.status,
        workflowStage: enriched.workflowStage || null,
      },
      programTier,
    });
    effects.auditRecorded = true;
  } catch {
    /* best-effort */
  }
  return effects;
}

/** Short English notice to the publication owner (researcher). */
function buildResearcherPublicationNotice(pub, kind, comment = "") {
  const title = pub.title || "Research output";
  const note = String(comment || "").trim();
  const noteSuffix = note ? ` Note: ${note.length > 220 ? `${note.slice(0, 217)}…` : note}` : "";

  switch (kind) {
    case "published":
      return {
        title: "Publication published",
        body: `Congratulations! Your research output "${title}" has been published and is now recorded in the institutional system. Please proceed with any follow-up reporting on your project.`,
      };
    case "accepted":
      return {
        title: "Publication accepted",
        body: `Your research output "${title}" was accepted by the Research Office. It is moving forward in the publication workflow — you will be notified when it is published.`,
      };
    case "rejected":
      return {
        title: "Publication not accepted",
        body: `Your research output "${title}" was not accepted.${noteSuffix || " Please review the feedback in your project outputs."}`,
      };
    case "revision":
      return {
        title: "Revision requested",
        body: `Revisions were requested on "${title}". Please update your submission and resubmit.${noteSuffix}`,
      };
    default:
      return {
        title: "Publication update",
        body: note ? `${title}: ${note.slice(0, 300)}` : title,
      };
  }
}

/** After Accept / Revise / Reject / Publish decision. */
async function afterPublicationDecision(req, pub, { kind, comment, decisionLabel }) {
  const resolvedKind =
    kind ||
    (decisionLabel?.includes("published")
      ? "published"
      : decisionLabel?.includes("accepted")
        ? "accepted"
        : decisionLabel?.includes("rejected")
          ? "rejected"
          : decisionLabel?.includes("revision")
            ? "revision"
            : "update");
  const notice = buildResearcherPublicationNotice(pub, resolvedKind, comment);
  return notifyPublicationEvent(req, pub, {
    title: notice.title,
    body: notice.body,
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
  buildPublicationSubmitNotificationBody,
  buildResearcherPublicationNotice,
  loadPublicationForNotification,
};

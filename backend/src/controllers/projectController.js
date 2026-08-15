const { Project, PROJECT_STATUSES, CLOSURE_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { RepositoryItem, REPOSITORY_ITEM_TYPES, REPOSITORY_ACCESS } = require("../models/RepositoryItem");
const path = require("path");
const { AppError } = require("../utils/AppError");
const { userDisplayName } = require("../utils/userDisplay");
const { resolvePrincipalInvestigatorId, resolvePrincipalInvestigatorName } = require("../utils/projectPrincipalInvestigator");
const { buildWorkflowForProject, canViewProjectAwards, sanitizeLinkedGrantsForViewer } = require("../utils/researchJourney");
const { recordAudit } = require("../utils/audit");
const { notifyUsersByRole, notifyUser } = require("../utils/notify");
const { buildProjectNotificationBody, loadProjectForNotification } = require("../utils/projectNotificationBody");
const { writeSimplePdf } = require("../utils/pdf");
const { resolveProjectStartDate, assertDateOnOrAfterProjectStart } = require("../utils/projectStartDate");
const { assertDateNotInPast, assertDateOnOrAfter } = require("../utils/dateConstraints");

function normalizeTeamMembers(team) {
  if (!Array.isArray(team)) return [];
  return team.map((m) => {
    if (typeof m === "string") return { name: m, userId: null, role: "member" };
    return { name: m.name || "Member", userId: m.userId || null, role: m.role || "member" };
  });
}

function attachPrincipalInvestigator(out, p) {
  const name = resolvePrincipalInvestigatorName(p);
  const piId = resolvePrincipalInvestigatorId(p);
  const researcher = p.researcherId && userDisplayName(p.researcherId) !== "—" ? p.researcherId : p.leadResearcher && userDisplayName(p.leadResearcher) !== "—" ? p.leadResearcher : null;
  if (researcher && typeof researcher === "object") {
    const displayName = userDisplayName(researcher);
    out.principalInvestigator = { id: researcher._id, fullName: displayName, email: researcher.email, department: researcher.department };
    out.principalInvestigatorName = displayName;
  } else if (name && name !== "—") {
    out.principalInvestigatorName = name;
    if (piId) out.principalInvestigator = { id: piId, fullName: name };
  } else if (name) {
    out.principalInvestigatorName = name;
  }
  if (piId) out.principalInvestigatorId = String(piId);
  return out;
}

async function resolveProjectKindMeta(req, project) {
  let proposalKind = "voluntary";
  let fundingCallId = null;
  const proposalId = project?.proposalId?._id || project?.proposalId || null;

  if (proposalId) {
    const linkedProposal = await Proposal.findById(proposalId).select(
      "proposalKind fundingCallId"
    );
    if (linkedProposal) {
      fundingCallId = linkedProposal.fundingCallId || null;
      proposalKind =
        linkedProposal.proposalKind ||
        (linkedProposal.fundingCallId ? "grant_fund_call" : "voluntary");
    }
  }

  const grantMatch = [{ projectId: project._id }];
  if (proposalId) grantMatch.push({ proposalId });
  const fundedGrant = await Grant.findOne({
    $and: [
      { $or: grantMatch },
      {
        $or: [
          { callId: { $ne: null, $exists: true }, status: { $in: ["pending_finance", "active", "approved"] } },
          { amountAwarded: { $gt: 0 } },
        ],
      },
    ],
  }).select("_id callId amountAwarded status");

  if (fundedGrant) {
    proposalKind = "grant_fund_call";
    if (fundedGrant.callId) fundingCallId = fundedGrant.callId;
  }

  const isVoluntary = proposalKind !== "grant_fund_call" && !fundingCallId && !fundedGrant;

  return {
    proposalKind: isVoluntary ? "voluntary" : "grant_fund_call",
    isVoluntary,
    fundingCallId: fundingCallId ? String(fundingCallId) : null,
  };
}

async function resolveProjectIsVoluntary(req, project) {
  const meta = await resolveProjectKindMeta(req, project);
  return meta.isVoluntary;
}

function sanitizeProject(p) {
  const researcherId = resolvePrincipalInvestigatorId(p);
  const proposalId = p.proposalId?._id || p.proposalId || p.proposal?._id || p.proposal;
  const reports = p.progressReports || [];
  const latestProgress = reports.length ? reports[0] : null;
  const progressPercent =
    latestProgress?.progressPercent ??
    (p.status === PROJECT_STATUSES.COMPLETED ? 100 : p.status === PROJECT_STATUSES.ACTIVE ? 0 : 0);
  const out = {
    id: p._id,
    proposalId,
    title: p.title,
    researcherId: researcherId ? String(researcherId) : null,
    milestones: p.milestones || [],
    teamMembers: p.teamMembers || [],
    workPlan: p.workPlan || [],
    activities: p.activities || [],
    communicationLog: (p.communicationLog || []).map((entry) => ({
      id: entry._id,
      type: entry.type,
      subject: entry.subject,
      body: entry.body,
      loggedAt: entry.loggedAt,
      loggedBy: entry.loggedBy?._id || entry.loggedBy,
      authorName: entry.loggedBy?.fullName || null,
    })),
    startDate: resolveProjectStartDate(p),
    endDate: p.endDate,
    status: p.status,
    progressReports: p.progressReports,
    progressPercent,
    closure: p.closure || { status: CLOSURE_STATUSES.NONE },
    programTier: p.programTier || null,
    programTierLabel:
      p.programTier === "postgraduate"
        ? "Postgraduate (PG)"
        : p.programTier === "undergraduate"
          ? "Undergraduate (UG)"
          : p.programTier || null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
  return attachPrincipalInvestigator(out, p);
}

const PROJECT_POPULATE = { path: "researcherId", select: "fullName name email department" };

function sanitizeProjectForFinanceClosure(p, { isVoluntary = false, proposalKind = "voluntary", budgetSummary = null } = {}) {
  const researcher = p.researcherId;
  return {
    id: p._id,
    title: p.title,
    status: p.status,
    closure: p.closure || { status: CLOSURE_STATUSES.NONE },
    isVoluntary,
    proposalKind,
    financeView: true,
    programTier: p.programTier || null,
    principalInvestigator: researcher?._id
      ? {
          fullName: researcher.fullName || researcher.name || null,
          department: researcher.department || null,
        }
      : null,
    budgetSummary,
  };
}

async function listProjects(req, res) {
  const { role } = req.user;
  const tierFilter =
    role === "researcher" ? req.ownedWhere({}) : req.tierWhere({});

  // Finance officers only see closure-related projects — not the general project catalogue.
  if (role === "finance_officer") {
    const projects = await Project.find({
      ...tierFilter,
      "closure.status": {
        $in: [
          CLOSURE_STATUSES.DIRECTOR_APPROVED,
          CLOSURE_STATUSES.FINANCE_APPROVED,
          CLOSURE_STATUSES.ARCHIVED,
        ],
      },
    })
      .sort({ updatedAt: -1 })
      .populate(PROJECT_POPULATE);

    const out = await Promise.all(
      projects.map(async (p) => {
        const kindMeta = await resolveProjectKindMeta(req, p);
        return sanitizeProjectForFinanceClosure(p, {
          isVoluntary: kindMeta.isVoluntary,
          proposalKind: kindMeta.proposalKind,
        });
      })
    );


    return res.json({ projects: out });
  }

  let projects = await Project.find(tierFilter).sort({ createdAt: -1 }).populate(PROJECT_POPULATE);
  const sanitized = await Promise.all(
    projects.map(async (p) => {
      const base = sanitizeProject(p);
      const kindMeta = await resolveProjectKindMeta(req, p);
      base.proposalKind = kindMeta.proposalKind;
      base.isVoluntary = kindMeta.isVoluntary;
      base.fundingCallId = kindMeta.fundingCallId;
      const wf = await buildWorkflowForProject(p._id, tierFilter, role);
      if (wf) {
        base.workflow = { currentStepLabel: wf.currentStepLabel, currentStepKey: wf.currentStepKey, progressPercent: wf.progressPercent };
        if (wf.progressPercent != null) base.progressPercent = wf.progressPercent;
      }
      return base;
    })
  );


  res.json({ projects: sanitized });
}

async function getProject(req, res) {
  const { id } = req.params;
  const baseProject =
    req.user.role === "researcher"
      ? await req.findOwned(Project, id)
      : await Project.findOne(req.tierWhere({ _id: id }));
  if (!baseProject) throw new AppError("Project not found", 404);
  const project = await Project.findById(baseProject._id)
    .populate(PROJECT_POPULATE)
    .populate("communicationLog.loggedBy", "fullName email role");
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId?._id || project.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director", "finance_officer"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  // Finance: return closure/finance payload only — never general project dossier.
  if (req.user.role === "finance_officer") {
    const kindMeta = await resolveProjectKindMeta(req, project);
    const isVoluntary = kindMeta.isVoluntary;
    const proposalKind = kindMeta.proposalKind;
    let budgetSummary = null;
    try {
      const { ensureBudgetForProject } = require("../utils/ensureBudgetForProject");
      const { remainingOf } = require("../utils/budgetDisbursement");
      const ensured = await ensureBudgetForProject(project);
      const budget = ensured.budget;
      if (budget) {
        budgetSummary = {
          totalAllocated: budget.totalAllocated,
          totalDisbursed: budget.totalDisbursed || 0,
          remainingBalance: remainingOf(budget),
          currency: budget.currency || "USD",
        };
      }
    } catch (_) { /* optional */ }


    return res.json({
      project: sanitizeProjectForFinanceClosure(project, { isVoluntary, proposalKind, budgetSummary }),
    });
  }


  const grantDocs = await Grant.find(
    req.relatedWhere(
      {
        $or: [
          { projectId: id },
          ...(project.proposalId
            ? [{ proposalId: project.proposalId?._id || project.proposalId }]
            : []),
        ],
      },
      { isOwner }
    )
  )
    .sort({ createdAt: -1 })
    .select("title status amountRequested amountAwarded currency fundingSource callId projectId");
  // Back-link any grants found only via proposalId
  for (const g of grantDocs) {
    if (!g.projectId || String(g.projectId) !== String(id)) {
      g.projectId = project._id;
      try { await g.save(); } catch { /* ignore */ }
    }
  }
  const tierFilter = req.relatedWhere({}, { isOwner });
  const hasPublication = await Publication.exists({
    projectId: project._id,
    status: { $in: [PUBLICATION_STATUSES.SUBMITTED, PUBLICATION_STATUSES.VALIDATED] },
    ...(Object.keys(tierFilter).length ? tierFilter : {}),
  });
  const canViewAwards = canViewProjectAwards({ role: req.user.role, hasProjectPublication: Boolean(hasPublication) });

  const kindMeta = await resolveProjectKindMeta(req, project);
  const isVoluntary = kindMeta.isVoluntary;

  const out = sanitizeProject(project);
  out.proposalKind = kindMeta.proposalKind;
  out.isVoluntary = isVoluntary;
  out.fundingCallId = kindMeta.fundingCallId;
  // Show linked grants on the project as soon as funding is linked — not only after Completed
  out.grantsVisible = !isVoluntary;
  out.awardsVisible = !isVoluntary && canViewAwards;
  out.linkedGrants = isVoluntary
    ? []
    : sanitizeLinkedGrantsForViewer(grantDocs.map((g) => ({
      id: g._id, title: g.title, status: g.status, amountRequested: g.amountRequested,
      amountAwarded: g.amountAwarded, currency: g.currency, fundingSource: g.fundingSource,
    })), canViewAwards, project);

  // Auto-allocate Budget when opening a funded project (proposal/grant amount → totalAllocated)
  if (!isVoluntary) {
    try {
      const { ensureBudgetForProject } = require("../utils/ensureBudgetForProject");
      const { remainingOf } = require("../utils/budgetDisbursement");
      const ensured = await ensureBudgetForProject(project, {
        grant: grantDocs[0] || null,
      });
      if (ensured.budget) {
        out.budgetSummary = {
          totalAllocated: ensured.budget.totalAllocated,
          totalDisbursed: ensured.budget.totalDisbursed || 0,
          remainingBalance: remainingOf(ensured.budget),
          currency: ensured.budget.currency || "USD",
          budgetId: String(ensured.budget._id),
        };
      }
    } catch (_) { /* best-effort */ }
  }


  try {
    out.workflow = await buildWorkflowForProject(id, tierFilter, req.user.role);
    if (out.workflow?.progressPercent != null) out.progressPercent = out.workflow.progressPercent;
  } catch (err) {
    // Still return the project dossier — workflow is helpful but must not blank the Open page.
    out.workflow = null;
    out.workflowError = err?.message || "Failed to build workflow";
  }
  res.json({ project: out });
}

async function updateProject(req, res) {
  const project = await req.findOwned(Project, req.params.id);
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId) === String(req.user.id);
  const isDirector = req.user.role === "research_director";
  if (!isOwner && !isDirector) throw new AppError("Forbidden", 403);

  const { milestones, teamMembers, workPlan, activities, endDate, status } = req.body;
  if (milestones !== undefined) {
    if (!Array.isArray(milestones)) throw new AppError("milestones must be an array", 400);
    project.milestones = milestones.map((m, idx) => {
      const dueDate = m.dueDate ? new Date(m.dueDate) : null;
      if (dueDate) {
        assertDateOnOrAfterProjectStart(project, dueDate, { fieldLabel: "Milestone due date" });
        assertDateNotInPast(dueDate, {
          fieldLabel: "Milestone due date",
          allowUnchangedFrom: project.milestones?.[idx]?.dueDate,
        });
      }
      return { title: m.title, dueDate, completed: Boolean(m.completed) };
    });
  }
  if (workPlan !== undefined) {
    if (!Array.isArray(workPlan)) throw new AppError("workPlan must be an array", 400);
    project.workPlan = workPlan.map((w, idx) => {
      const rowStart = w.startDate ? new Date(w.startDate) : null;
      const rowEnd = w.endDate ? new Date(w.endDate) : null;
      const prev = project.workPlan?.[idx] || {};
      if (rowStart) {
        assertDateOnOrAfterProjectStart(project, rowStart, { fieldLabel: "Work plan start date" });
        assertDateNotInPast(rowStart, {
          fieldLabel: "Work plan start date",
          allowUnchangedFrom: prev.startDate,
        });
      }
      if (rowEnd) {
        assertDateOnOrAfterProjectStart(project, rowEnd, { fieldLabel: "Work plan end date" });
        assertDateNotInPast(rowEnd, {
          fieldLabel: "Work plan end date",
          allowUnchangedFrom: prev.endDate,
        });
        if (rowStart) assertDateOnOrAfter(rowEnd, rowStart, { fieldLabel: "Work plan end date", earlierLabel: "start date" });
      }
      return {
        phase: String(w.phase || "").trim(),
        description: String(w.description || "").trim(),
        startDate: rowStart,
        endDate: rowEnd,
        owner: String(w.owner || "").trim(),
        status: ["planned", "in_progress", "completed"].includes(w.status) ? w.status : "planned",
      };
    }).filter((w) => w.phase);
  }
  if (activities !== undefined) {
    if (!Array.isArray(activities)) throw new AppError("activities must be an array", 400);
    project.activities = activities.map((a, idx) => {
      const dueDate = a.dueDate ? new Date(a.dueDate) : null;
      if (dueDate) {
        assertDateOnOrAfterProjectStart(project, dueDate, { fieldLabel: "Activity due date" });
        assertDateNotInPast(dueDate, {
          fieldLabel: "Activity due date",
          allowUnchangedFrom: project.activities?.[idx]?.dueDate,
        });
      }
      return {
        title: String(a.title || "").trim(),
        description: String(a.description || "").trim(),
        dueDate,
        status: ["todo", "in_progress", "done", "blocked"].includes(a.status) ? a.status : "todo",
        assignedTo: String(a.assignedTo || "").trim(),
        completedAt: a.status === "done" ? (a.completedAt ? new Date(a.completedAt) : new Date()) : null,
        createdBy: a.createdBy || req.user.id,
      };
    }).filter((a) => a.title);
  }
  if (teamMembers !== undefined) {
    if (!Array.isArray(teamMembers)) throw new AppError("teamMembers must be an array", 400);
    project.teamMembers = normalizeTeamMembers(teamMembers);
  }
  if (endDate !== undefined) {
    const nextEnd = endDate ? new Date(endDate) : null;
    if (nextEnd) {
      assertDateOnOrAfterProjectStart(project, nextEnd, { fieldLabel: "End date" });
      assertDateNotInPast(nextEnd, { fieldLabel: "End date", allowUnchangedFrom: project.endDate });
    }
    project.endDate = nextEnd;
  }
  if (status !== undefined) {
    if (!Object.values(PROJECT_STATUSES).includes(status)) throw new AppError("Invalid status", 400);
    if (!isDirector && status !== project.status) throw new AppError("Only director can change project status", 403);
    project.status = status;
  }

  await project.save();
  const updated = await Project.findById(project._id).populate(PROJECT_POPULATE);
  res.json({ message: "Project updated", project: sanitizeProject(updated) });
}

async function addProgressReport(req, res) {
  throw new AppError(
    "Manual progress updates are disabled. Project progress is calculated automatically from the research workflow.",
    403
  );
}

async function submitClosure(req, res) {
  const { finalReport, auditNotes, assetHandover, lessonsLearned, checklist } = req.body || {};
  if (!finalReport) throw new AppError("finalReport is required", 400);

  const project = await req.findOwned(Project, req.params.id);
  if (!project) throw new AppError("Project not found", 404);
  if (String(project.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (project.closure?.status && project.closure.status !== CLOSURE_STATUSES.NONE) {
    throw new AppError("Closure already in progress", 400);
  }

  const isVoluntary = await resolveProjectIsVoluntary(req, project);
  const checklistData = checklist || {};
  const mergedChecklist = {
    publicationsArchived: Boolean(checklistData.publicationsArchived),
    assetsHandedOver: Boolean(checklistData.assetsHandedOver),
    dataArchived: Boolean(checklistData.dataArchived),
    // Grant-funded: Finance clears money on Project closure (Finance) queue.
    // Voluntary: no grant funds — treat as cleared.
    financialCleared: isVoluntary ? true : false,
    ethicsClosed: Boolean(checklistData.ethicsClosed),
  };
  // PI never self-certifies financial clearance for grant projects.
  const requiredKeys = ["publicationsArchived", "assetsHandedOver", "dataArchived", "ethicsClosed"];
  const allChecked = requiredKeys.every((k) => Boolean(mergedChecklist[k]));
  if (!allChecked) {
    throw new AppError("Complete the closure checklist before submitting", 400);
  }

  project.closure = {
    status: CLOSURE_STATUSES.SUBMITTED,
    finalReport: String(finalReport),
    auditNotes: auditNotes ? String(auditNotes) : "",
    assetHandover: assetHandover ? String(assetHandover) : "",
    lessonsLearned: lessonsLearned ? String(lessonsLearned) : "",
    checklist: mergedChecklist,
    submittedAt: new Date(),
  };
  project.status = PROJECT_STATUSES.CLOSING;
  await project.save();


  try {
    const populated = await loadProjectForNotification(project);
    await notifyUsersByRole("research_director", {
      type: "project",
      title: "Project closure submitted",
      body: buildProjectNotificationBody(populated, { context: "closure_submitted" }),
      link: `/projects/${project._id}#closure`,
      programTier: req.notifyProgramTier?.(project) || req.programTier,
    }, req.programTier);
  } catch { /* best-effort */ }

  await recordAudit({
    entityType: "project",
    entityId: project._id,
    action: "closure_submitted",
    label: "Project closure submitted",
    detail: project.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  const updated = await Project.findById(project._id).populate(PROJECT_POPULATE);
  res.json({ message: "Closure submitted", project: sanitizeProject(updated) });
}

async function directorClosureApproval(req, res) {
  const { comment } = req.body || {};
  const project = await req.findOwned(Project, req.params.id);
  if (!project) throw new AppError("Project not found", 404);
  if (project.closure?.status !== CLOSURE_STATUSES.SUBMITTED) {
    throw new AppError("No closure pending director approval", 400);
  }

  const isVoluntary = await resolveProjectIsVoluntary(req, project);
  project.closure.directorApprovedAt = new Date();
  project.closure.directorApprovedBy = req.user.id;
  if (comment) project.closure.auditNotes = `${project.closure.auditNotes || ""}\n[Director] ${comment}`.trim();

  // Only voluntary projects skip Finance. Grant-funded always enter the Finance closure queue.
  if (isVoluntary) {
    project.closure.status = CLOSURE_STATUSES.FINANCE_APPROVED;
    project.closure.financeApprovedAt = new Date();
    project.closure.financeApprovedBy = req.user.id;
    project.closure.checklist = {
      ...(project.closure.checklist || {}),
      financialCleared: true,
    };
  } else {
    project.closure.status = CLOSURE_STATUSES.DIRECTOR_APPROVED;
    project.closure.checklist = {
      ...(project.closure.checklist || {}),
      financialCleared: false,
    };
  }
  await project.save();

  // Voluntary: final approval is Director → close project immediately.
  if (isVoluntary) {
    await finalizeClosedProject(req, project);
  }


  if (!isVoluntary) {
    try {
      const populated = await loadProjectForNotification(project);
      await notifyUsersByRole(
        "finance_officer",
        {
          type: "project",
          title: "Project closure pending finance",
          body: buildProjectNotificationBody(populated, {
            context: "closure_pending_finance",
            comment: comment ? String(comment).trim() : "",
          }),
          link: `/finance/closures/${project._id}`,
          programTier: req.notifyProgramTier?.(project) || project.programTier || req.programTier,
        },
        project.programTier || req.programTier
      );
    } catch { /* best-effort */ }
  }

  await recordAudit({
    entityType: "project",
    entityId: project._id,
    action: isVoluntary ? "closure_director_approved_voluntary" : "closure_director_approved",
    label: isVoluntary
      ? "Director approved voluntary closure — project closed"
      : "Director approved closure — queued for Finance",
    detail: project.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  const updated = await Project.findById(project._id).populate(PROJECT_POPULATE);
  res.json({
    message: isVoluntary
      ? "Director approved — project closed"
      : "Director approved — waiting for Finance clearance",
    project: sanitizeProject(updated),
  });
}

async function financeClosureApproval(req, res) {
  const { comment } = req.body || {};
  const project = await req.findOwned(Project, req.params.id);
  if (!project) throw new AppError("Project not found", 404);
  if (project.closure?.status !== CLOSURE_STATUSES.DIRECTOR_APPROVED) {
    throw new AppError("Closure not ready for finance approval", 400);
  }

  project.closure.status = CLOSURE_STATUSES.FINANCE_APPROVED;
  project.closure.financeApprovedAt = new Date();
  project.closure.financeApprovedBy = req.user.id;
  project.closure.checklist = {
    ...(project.closure.checklist || {}),
    financialCleared: true,
  };
  if (comment) project.closure.auditNotes = `${project.closure.auditNotes || ""}\n[Finance] ${comment}`.trim();
  await project.save();

  // Final clearance → project closes automatically (no separate archive click).
  await finalizeClosedProject(req, project);


  await recordAudit({
    entityType: "project",
    entityId: project._id,
    action: "closure_finance_approved",
    label: "Finance approved closure — project closed",
    detail: project.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  const updated = await Project.findById(project._id).populate(PROJECT_POPULATE);
  res.json({ message: "Finance cleared — project closed", project: sanitizeProject(updated) });
}

/**
 * Mark project fully closed after final clearance (Director for voluntary, Finance for grant).
 */
async function finalizeClosedProject(req, project) {
  project.closure.status = CLOSURE_STATUSES.ARCHIVED;
  project.closure.archivedAt = new Date();
  project.status = PROJECT_STATUSES.COMPLETED;
  await project.save();

  try {
    await Grant.updateMany(
      { projectId: project._id, status: { $ne: GRANT_STATUSES.REJECTED } },
      { $set: { status: GRANT_STATUSES.CLOSED } }
    );
  } catch { /* best-effort */ }


  try {
    const archiveDir = path.join(process.cwd(), "uploads", "repository", String(project._id));
    const archiveFile = path.join(archiveDir, `closure-${Date.now()}.pdf`);
    const lines = [
      `Project: ${project.title}`,
      `Status: Closed / Archived`,
      `Final report: ${project.closure?.finalReport || "—"}`,
      `Lessons learned: ${project.closure?.lessonsLearned || "—"}`,
      `Archived at: ${new Date().toISOString()}`,
    ];
    await writeSimplePdf({
      filePath: archiveFile,
      title: "Project Closure Archive",
      author: "Jamhuriya RMS",
      bodyLines: lines,
    });

    const webPath = `/uploads/repository/${String(project._id)}/closure-${path.basename(archiveFile)}`;
    const existingRepo = await RepositoryItem.findOne({
      projectId: project._id,
      title: { $regex: /^Project closure archive:/i },
    });
    if (!existingRepo) {
      await RepositoryItem.create(
        req.tierAssign({
          type: REPOSITORY_ITEM_TYPES.DOCUMENT,
          title: `Project closure archive: ${project.title}`,
          description: project.closure?.finalReport || "Archived on project closure",
          filePath: webPath,
          fileSize: 0,
          access: REPOSITORY_ACCESS.INSTITUTION,
          projectId: project._id,
          uploadedBy: project.researcherId,
          programTier: project.programTier,
        })
      );
    }
  } catch { /* best-effort archive PDF */ }

  try {
    const populated = await loadProjectForNotification(project);
    await notifyUser(project.researcherId, {
      type: "project",
      title: "Project closed",
      body: buildProjectNotificationBody(populated, { context: "project_closed" }),
      link: `/projects/${project._id}`,
      programTier: project.programTier || req.programTier,
    });
  } catch { /* best-effort */ }

  return project;
}

async function archiveProject(req, res) {
  const project = await req.findOwned(Project, req.params.id);
  if (!project) throw new AppError("Project not found", 404);
  if (
    project.closure?.status !== CLOSURE_STATUSES.FINANCE_APPROVED &&
    project.closure?.status !== CLOSURE_STATUSES.ARCHIVED
  ) {
    throw new AppError("Closure must be finance-approved before archive", 400);
  }

  if (project.closure.status !== CLOSURE_STATUSES.ARCHIVED) {
    await finalizeClosedProject(req, project);
  }

  await recordAudit({
    entityType: "project",
    entityId: project._id,
    action: "archived",
    label: "Project archived",
    detail: project.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: project.programTier || req.programTier,
  });

  res.json({ message: "Project archived", project: sanitizeProject(project) });
}

async function exportTechnicalReportPdf(req, res) {
  const baseProject =
    req.user.role === "researcher"
      ? await req.findOwned(Project, req.params.id)
      : await Project.findOne(req.tierWhere({ _id: req.params.id }));
  if (!baseProject) throw new AppError("Project not found", 404);
  const project = await Project.findById(baseProject._id).populate(PROJECT_POPULATE);
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId?._id || project.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "faculty_coordinator", "finance_officer", "leadership"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  const wfScope =
    req.user.role === "researcher" ? req.ownedWhere({}) : req.tierWhere({});
  const wf = await buildWorkflowForProject(project._id, wfScope, req.user.role);
  const autoProgress = wf?.progressPercent ?? (project.status === PROJECT_STATUSES.COMPLETED ? 100 : null);
  const lines = [
    `Project: ${project.title}`,
    `PI: ${userDisplayName(project.researcherId)}`,
    `Status: ${project.status}`,
    `Period: ${resolveProjectStartDate(project) ? new Date(resolveProjectStartDate(project)).toLocaleDateString() : "—"} – ${project.endDate ? new Date(project.endDate).toLocaleDateString() : "—"}`,
    "",
    "Progress (automatic from workflow):",
    autoProgress != null ? `${autoProgress}% complete` : "—",
    wf?.currentStepLabel ? `Current step: ${wf.currentStepLabel}` : "",
    "",
    `Generated: ${new Date().toISOString()}`,
  ].filter(Boolean);

  const outDir = path.join(process.cwd(), "uploads", "reports");
  const outFile = path.join(outDir, `technical-${project._id}-${Date.now()}.pdf`);
  await writeSimplePdf({
    filePath: outFile,
    title: "Technical Progress Report",
    author: userDisplayName(project.researcherId),
    bodyLines: lines,
  });

  res.download(outFile, `technical-report-${project.title.replace(/[^\w.-]+/g, "_").slice(0, 40)}.pdf`);
}

async function addCommunicationLog(req, res) {
  const { type, subject, body } = req.body || {};
  if (!body?.trim()) throw new AppError("body is required", 400);

  const project = await req.findOwned(Project, req.params.id);
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "faculty_coordinator", "finance_officer"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  project.communicationLog.unshift({
    type: ["note", "email", "meeting", "decision", "other"].includes(type) ? type : "note",
    subject: subject ? String(subject).trim() : "",
    body: String(body).trim(),
    loggedBy: req.user.id,
    loggedAt: new Date(),
  });
  await project.save();

  await recordAudit({
    entityType: "project",
    entityId: project._id,
    action: "communication_logged",
    label: "Project communication logged",
    detail: subject || String(body).slice(0, 120),
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  const updated = await Project.findById(project._id)
    .populate(PROJECT_POPULATE)
    .populate("communicationLog.loggedBy", "fullName email role");
  res.status(201).json({ message: "Communication logged", project: sanitizeProject(updated) });
}

async function backfillProjectFromApprovedProposal(req, res) {
  const { proposalId } = req.params;
  const proposal = await Proposal.findOne(req.tierWhere({ _id: proposalId }));
  if (!proposal) throw new AppError("Proposal not found", 404);
  if (proposal.status !== PROPOSAL_STATUSES.APPROVED) throw new AppError("Proposal is not approved", 400);

  const existing = await Project.findOne(req.tierWhere({ proposalId: proposal._id })).populate(PROJECT_POPULATE);
  if (existing) return res.json({ message: "Project already exists", project: sanitizeProject(existing) });

  const project = await Project.create(req.tierAssign({
    proposalId: proposal._id,
    title: proposal.title,
    researcherId: proposal.researcherId,
    programTier: proposal.programTier,
    teamMembers: [],
    milestones: [],
    status: "active",
    progressReports: [],
  }));

  const created = await Project.findById(project._id).populate(PROJECT_POPULATE);
  res.status(201).json({ message: "Project created", project: sanitizeProject(created) });
}

async function deleteProject(req, res) {
  const { id } = req.params;
  const project =
    req.user.role === "researcher"
      ? await req.findOwned(Project, id)
      : await Project.findOne(req.tierWhere({ _id: id }));
  if (!project) throw new AppError("Project not found", 404);

  const isDirector = req.user.role === "research_director";
  const isOwner = String(project.researcherId?._id || project.researcherId) === String(req.user.id);
  if (!isDirector && !isOwner) throw new AppError("Forbidden", 403);

  if (!isDirector) {
    const blockedPub = await Publication.findOne({
      projectId: project._id,
      status: { $in: [PUBLICATION_STATUSES.SUBMITTED, PUBLICATION_STATUSES.VALIDATED] },
    }).select("_id title status");
    if (blockedPub) {
      throw new AppError(
        "Cannot delete project while it has a submitted or validated output. Delete or withdraw the output first.",
        400
      );
    }
    const activeGrant = await Grant.findOne({
      projectId: project._id,
      status: { $in: [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.PENDING_FINANCE, GRANT_STATUSES.APPROVED] },
    }).select("_id title status");
    if (activeGrant) {
      throw new AppError("Cannot delete project with an active or approved grant", 400);
    }
  }

  const { Budget } = require("../models/Budget");
  const { Payment } = require("../models/Payment");
  const { EthicsApplication } = require("../models/EthicsApplication");

  const projectId = project._id;
  const title = project.title;

  const budgets = await Budget.find({ projectId }).select("_id totalAllocated");
  const allocatedBudgets = budgets.filter((b) => Number(b.totalAllocated || 0) > 0);
  if (allocatedBudgets.length) {
    throw new AppError(
      "Cannot delete project: Budget allocated is locked system-wide. Allocated budgets cannot be deleted.",
      400
    );
  }

  const budgetIds = budgets.map((b) => b._id);
  if (budgetIds.length) {
    await Payment.deleteMany({ budgetId: { $in: budgetIds } });
    await Budget.deleteMany({ _id: { $in: budgetIds } });
  }

  await Publication.deleteMany({ projectId });
  await RepositoryItem.deleteMany({ projectId });
  await EthicsApplication.deleteMany({ projectId });
  await Grant.updateMany({ projectId }, { $set: { projectId: null } });
  await Project.deleteOne({ _id: projectId });


  try {
    await recordAudit({
      entityType: "project",
      entityId: projectId,
      action: "deleted",
      label: "Project deleted",
      detail: title,
      actorId: req.user?.id,
      actorRole: req.user?.role,
      programTier: project.programTier || req.programTier,
    });
  } catch {
    /* optional */
  }

  res.json({ message: "Project deleted", id: String(projectId) });
}

module.exports = {
  listProjects,
  getProject,
  updateProject,
  addProgressReport,
  submitClosure,
  directorClosureApproval,
  financeClosureApproval,
  archiveProject,
  deleteProject,
  exportTechnicalReportPdf,
  addCommunicationLog,
  backfillProjectFromApprovedProposal,
};

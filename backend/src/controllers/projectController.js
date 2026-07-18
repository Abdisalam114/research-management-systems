const { Project, PROJECT_STATUSES, CLOSURE_STATUSES } = require("../models/Project");
const { Grant } = require("../models/Grant");
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
const { writeSimplePdf } = require("../utils/pdf");

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

async function resolveProjectIsVoluntary(req, project) {
  if (!project?.proposalId) return true;
  const linkedProposal = await Proposal.findOne(req.tierWhere({ _id: project.proposalId })).select(
    "proposalKind fundingCallId"
  );
  if (!linkedProposal) return true;
  const proposalKind =
    linkedProposal.proposalKind ||
    (linkedProposal.fundingCallId ? "grant_fund_call" : "voluntary");
  return proposalKind === "voluntary" || (!linkedProposal.fundingCallId && proposalKind !== "grant_fund_call");
}

function sanitizeProject(p) {
  const researcherId = resolvePrincipalInvestigatorId(p);
  const proposalId = p.proposalId?._id || p.proposalId || p.proposal?._id || p.proposal;
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
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    progressReports: p.progressReports,
    closure: p.closure || { status: CLOSURE_STATUSES.NONE },
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
  const tierFilter = req.tierWhere(role === "researcher" ? { researcherId: req.user.id } : {});

  // Finance officers only see closure-related projects — not the general project catalogue.
  if (role === "finance_officer") {
    const projects = await Project.find({
      ...tierFilter,
      "closure.status": { $in: [CLOSURE_STATUSES.DIRECTOR_APPROVED, CLOSURE_STATUSES.FINANCE_APPROVED, CLOSURE_STATUSES.ARCHIVED] },
    })
      .sort({ updatedAt: -1 })
      .populate(PROJECT_POPULATE);

    const out = await Promise.all(
      projects.map(async (p) => {
        let proposalKind = "voluntary";
        let fundingCallId = null;
        if (p.proposalId) {
          const linked = await Proposal.findOne(req.tierWhere({ _id: p.proposalId })).select("proposalKind fundingCallId");
          if (linked) {
            fundingCallId = linked.fundingCallId || null;
            proposalKind = linked.proposalKind || (linked.fundingCallId ? "grant_fund_call" : "voluntary");
          }
        }
        const isVoluntary = proposalKind === "voluntary" || (!fundingCallId && proposalKind !== "grant_fund_call");
        return sanitizeProjectForFinanceClosure(p, { isVoluntary, proposalKind });
      })
    );
    return res.json({ projects: out });
  }

  const projects = await Project.find(tierFilter).sort({ createdAt: -1 }).populate(PROJECT_POPULATE);
  const sanitized = await Promise.all(
    projects.map(async (p) => {
      const base = sanitizeProject(p);
      const wf = await buildWorkflowForProject(p._id, tierFilter, role);
      if (wf) base.workflow = { currentStepLabel: wf.currentStepLabel, currentStepKey: wf.currentStepKey, progressPercent: wf.progressPercent };
      return base;
    })
  );
  res.json({ projects: sanitized });
}

async function getProject(req, res) {
  const { id } = req.params;
  const project = await Project.findOne(req.tierWhere({ _id: id }))
    .populate(PROJECT_POPULATE)
    .populate("communicationLog.loggedBy", "fullName email role");
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId?._id || project.researcherId) === String(req.user.id);
  const isStaff = ["faculty_coordinator", "research_director", "finance_officer", "procurement_officer", "ethics_committee", "hr_officer"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  // Finance: return closure/finance payload only — never general project dossier.
  if (req.user.role === "finance_officer") {
    let proposalKind = "voluntary";
    let fundingCallId = null;
    if (project.proposalId) {
      const linkedProposal = await Proposal.findOne(req.tierWhere({ _id: project.proposalId })).select("proposalKind fundingCallId");
      if (linkedProposal) {
        fundingCallId = linkedProposal.fundingCallId || null;
        proposalKind =
          linkedProposal.proposalKind ||
          (linkedProposal.fundingCallId ? "grant_fund_call" : "voluntary");
      }
    }
    const isVoluntary = proposalKind === "voluntary" || (!fundingCallId && proposalKind !== "grant_fund_call");
    let budgetSummary = null;
    try {
      const { Budget } = require("../models/Budget");
      const { remainingOf } = require("../utils/budgetDisbursement");
      const budget = await Budget.findOne(req.tierWhere({ projectId: project._id })).select("totalAllocated totalDisbursed currency");
      if (budget) {
        budgetSummary = {
          totalAllocated: budget.totalAllocated,
          totalDisbursed: budget.totalDisbursed || 0,
          remainingBalance: remainingOf(budget),
          currency: budget.currency || "USD",
        };
      }
    } catch (_) { /* optional */ }

    // #region agent log
    try {
      const p = require("path");
      const fs = require("fs");
      const line = `${JSON.stringify({
        sessionId: "f558f7",
        hypothesisId: "H7",
        location: "projectController.getProject",
        message: "finance closure view only",
        data: { projectId: String(id), closureStatus: project.closure?.status || null, financeView: true },
        timestamp: Date.now(),
      })}\n`;
      fs.appendFileSync(p.join(__dirname, "..", "..", "..", "debug-f558f7.log"), line);
      fs.appendFileSync(p.join(__dirname, "..", "..", "..", ".cursor", "debug-f558f7.log"), line);
    } catch (_) { /* debug */ }
    // #endregion

    return res.json({
      project: sanitizeProjectForFinanceClosure(project, { isVoluntary, proposalKind, budgetSummary }),
    });
  }

  // #region agent log
  try {
    const p = require("path");
    const fs = require("fs");
    const line = `${JSON.stringify({
      sessionId: "f558f7",
      hypothesisId: "H1",
      location: "projectController.getProject",
      message: "project access ok",
      data: { role: req.user.role, projectId: String(id), closureStatus: project.closure?.status || null },
      timestamp: Date.now(),
    })}\n`;
    fs.appendFileSync(p.join(__dirname, "..", "..", "..", "debug-f558f7.log"), line);
    fs.appendFileSync(p.join(__dirname, "..", "..", "..", ".cursor", "debug-f558f7.log"), line);
  } catch (_) { /* debug */ }
  // #endregion

  const grantDocs = await Grant.find(req.tierWhere({
    projectId: id,
    callId: { $ne: null, $exists: true },
  })).sort({ createdAt: -1 }).select("title status amountRequested amountAwarded currency fundingSource callId");
  const tierFilter = req.tierWhere({});
  const hasPublication = await Publication.exists({
    ...tierFilter,
    projectId: project._id,
    status: { $in: [PUBLICATION_STATUSES.SUBMITTED, PUBLICATION_STATUSES.VALIDATED] },
  });
  const canViewAwards = canViewProjectAwards({ role: req.user.role, hasProjectPublication: Boolean(hasPublication) });

  let proposalKind = "voluntary";
  let fundingCallId = null;
  if (project.proposalId) {
    const linkedProposal = await Proposal.findOne(req.tierWhere({ _id: project.proposalId })).select("proposalKind fundingCallId");
    if (linkedProposal) {
      fundingCallId = linkedProposal.fundingCallId || null;
      proposalKind =
        linkedProposal.proposalKind ||
        (linkedProposal.fundingCallId ? "grant_fund_call" : "voluntary");
    }
  }
  const isVoluntary = proposalKind === "voluntary" || (!fundingCallId && proposalKind !== "grant_fund_call");

  const out = sanitizeProject(project);
  out.proposalKind = proposalKind;
  out.isVoluntary = isVoluntary;
  out.grantsVisible = !isVoluntary && (project.status === PROJECT_STATUSES.COMPLETED || project.status === PROJECT_STATUSES.CLOSED);
  out.awardsVisible = !isVoluntary && canViewAwards;
  out.linkedGrants = isVoluntary
    ? []
    : sanitizeLinkedGrantsForViewer(grantDocs.map((g) => ({
      id: g._id, title: g.title, status: g.status, amountRequested: g.amountRequested,
      amountAwarded: g.amountAwarded, currency: g.currency, fundingSource: g.fundingSource,
    })), canViewAwards, project);
  out.workflow = await buildWorkflowForProject(id, tierFilter, req.user.role);
  res.json({ project: out });
}

async function updateProject(req, res) {
  const project = await Project.findOne(req.tierWhere({ _id: req.params.id }));
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId) === String(req.user.id);
  const isDirector = req.user.role === "research_director";
  if (!isOwner && !isDirector) throw new AppError("Forbidden", 403);

  const { milestones, teamMembers, workPlan, activities, startDate, endDate, status } = req.body;
  if (milestones !== undefined) {
    if (!Array.isArray(milestones)) throw new AppError("milestones must be an array", 400);
    project.milestones = milestones.map((m) => ({ title: m.title, dueDate: m.dueDate ? new Date(m.dueDate) : null, completed: Boolean(m.completed) }));
  }
  if (workPlan !== undefined) {
    if (!Array.isArray(workPlan)) throw new AppError("workPlan must be an array", 400);
    project.workPlan = workPlan.map((w) => ({
      phase: String(w.phase || "").trim(),
      description: String(w.description || "").trim(),
      startDate: w.startDate ? new Date(w.startDate) : null,
      endDate: w.endDate ? new Date(w.endDate) : null,
      owner: String(w.owner || "").trim(),
      status: ["planned", "in_progress", "completed"].includes(w.status) ? w.status : "planned",
    })).filter((w) => w.phase);
  }
  if (activities !== undefined) {
    if (!Array.isArray(activities)) throw new AppError("activities must be an array", 400);
    project.activities = activities.map((a) => ({
      title: String(a.title || "").trim(),
      description: String(a.description || "").trim(),
      dueDate: a.dueDate ? new Date(a.dueDate) : null,
      status: ["todo", "in_progress", "done", "blocked"].includes(a.status) ? a.status : "todo",
      assignedTo: String(a.assignedTo || "").trim(),
      completedAt: a.status === "done" ? (a.completedAt ? new Date(a.completedAt) : new Date()) : null,
      createdBy: a.createdBy || req.user.id,
    })).filter((a) => a.title);
  }
  if (teamMembers !== undefined) {
    if (!Array.isArray(teamMembers)) throw new AppError("teamMembers must be an array", 400);
    project.teamMembers = normalizeTeamMembers(teamMembers);
  }
  if (startDate !== undefined) project.startDate = startDate ? new Date(startDate) : project.startDate;
  if (endDate !== undefined) project.endDate = endDate ? new Date(endDate) : null;
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
  const { note, progressPercent } = req.body;
  if (!note) throw new AppError("note is required", 400);

  const project = await Project.findOne(req.tierWhere({ _id: req.params.id }));
  if (!project) throw new AppError("Project not found", 404);
  if (String(project.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);

  project.progressReports.unshift({ note, progressPercent: typeof progressPercent === "number" ? progressPercent : 0, createdBy: req.user.id });
  await project.save();
  const updated = await Project.findById(project._id).populate(PROJECT_POPULATE);
  res.json({ message: "Progress report added", project: sanitizeProject(updated) });
}

async function submitClosure(req, res) {
  const { finalReport, auditNotes, assetHandover, lessonsLearned, checklist } = req.body || {};
  if (!finalReport) throw new AppError("finalReport is required", 400);

  const project = await Project.findOne(req.tierWhere({ _id: req.params.id }));
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
    // Voluntary projects have no finance track — treat as cleared automatically
    financialCleared: isVoluntary ? true : Boolean(checklistData.financialCleared),
    ethicsClosed: Boolean(checklistData.ethicsClosed),
  };
  const requiredKeys = isVoluntary
    ? ["publicationsArchived", "assetsHandedOver", "dataArchived", "ethicsClosed"]
    : Object.keys(mergedChecklist);
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
    await notifyUsersByRole("research_director", {
      type: "project",
      title: "Project closure submitted",
      body: project.title,
      link: `/projects/${project._id}`,
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
  const project = await Project.findOne(req.tierWhere({ _id: req.params.id }));
  if (!project) throw new AppError("Project not found", 404);
  if (project.closure?.status !== CLOSURE_STATUSES.SUBMITTED) {
    throw new AppError("No closure pending director approval", 400);
  }

  const isVoluntary = await resolveProjectIsVoluntary(req, project);
  project.closure.directorApprovedAt = new Date();
  project.closure.directorApprovedBy = req.user.id;
  if (comment) project.closure.auditNotes = `${project.closure.auditNotes || ""}\n[Director] ${comment}`.trim();

  if (isVoluntary) {
    // No finance stage for voluntary research — ready to archive after director
    project.closure.status = CLOSURE_STATUSES.FINANCE_APPROVED;
    project.closure.financeApprovedAt = new Date();
    project.closure.financeApprovedBy = req.user.id;
    project.closure.checklist = {
      ...(project.closure.checklist || {}),
      financialCleared: true,
    };
  } else {
    project.closure.status = CLOSURE_STATUSES.DIRECTOR_APPROVED;
  }
  await project.save();

  if (!isVoluntary) {
    try {
      await notifyUsersByRole("finance_officer", {
        type: "project",
        title: "Project closure pending finance",
        body: project.title,
        link: `/projects/${project._id}`,
      }, req.programTier);
    } catch { /* best-effort */ }
  } else {
    try {
      await notifyUser(project.researcherId, {
        type: "project",
        title: "Closure approved — ready to archive",
        body: project.title,
        link: `/projects/${project._id}`,
        programTier: req.programTier,
      });
    } catch { /* best-effort */ }
  }

  await recordAudit({
    entityType: "project",
    entityId: project._id,
    action: isVoluntary ? "closure_director_approved_voluntary" : "closure_director_approved",
    label: isVoluntary
      ? "Director approved voluntary closure (finance skipped)"
      : "Director approved closure",
    detail: project.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Director closure approval saved", project: sanitizeProject(project) });
}

async function financeClosureApproval(req, res) {
  const { comment } = req.body || {};
  const project = await Project.findOne(req.tierWhere({ _id: req.params.id }));
  if (!project) throw new AppError("Project not found", 404);
  if (project.closure?.status !== CLOSURE_STATUSES.DIRECTOR_APPROVED) {
    throw new AppError("Closure not ready for finance approval", 400);
  }

  project.closure.status = CLOSURE_STATUSES.FINANCE_APPROVED;
  project.closure.financeApprovedAt = new Date();
  project.closure.financeApprovedBy = req.user.id;
  if (comment) project.closure.auditNotes = `${project.closure.auditNotes || ""}\n[Finance] ${comment}`.trim();
  await project.save();

  await recordAudit({
    entityType: "project",
    entityId: project._id,
    action: "closure_finance_approved",
    label: "Finance approved closure",
    detail: project.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Finance closure approval saved", project: sanitizeProject(project) });
}

async function archiveProject(req, res) {
  const project = await Project.findOne(req.tierWhere({ _id: req.params.id }));
  if (!project) throw new AppError("Project not found", 404);
  if (project.closure?.status !== CLOSURE_STATUSES.FINANCE_APPROVED) {
    throw new AppError("Closure must be finance-approved before archive", 400);
  }

  project.closure.status = CLOSURE_STATUSES.ARCHIVED;
  project.closure.archivedAt = new Date();
  project.status = PROJECT_STATUSES.CLOSED;
  await project.save();

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

  const existingRepo = await RepositoryItem.findOne({
    projectId: project._id,
    title: { $regex: /^Project closure archive:/i },
  });
  if (!existingRepo) {
    await RepositoryItem.create(req.tierAssign({
      type: REPOSITORY_ITEM_TYPES.DOCUMENT,
      title: `Project closure archive: ${project.title}`,
      description: project.closure?.finalReport || "Archived on project closure",
      filePath: archiveFile.replace(/\\/g, "/"),
      fileSize: 0,
      access: REPOSITORY_ACCESS.INSTITUTION,
      projectId: project._id,
      uploadedBy: project.researcherId,
    }));
  }

  try {
    await notifyUser(project.researcherId, {
      type: "project",
      title: "Project archived",
      body: project.title,
      link: `/projects/${project._id}`,
      programTier: req.programTier,
    });
  } catch { /* best-effort */ }

  await recordAudit({
    entityType: "project",
    entityId: project._id,
    action: "archived",
    label: "Project archived",
    detail: project.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Project archived", project: sanitizeProject(project) });
}

async function exportTechnicalReportPdf(req, res) {
  const project = await Project.findOne(req.tierWhere({ _id: req.params.id })).populate(PROJECT_POPULATE);
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId?._id || project.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "faculty_coordinator", "finance_officer", "leadership"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  const reports = project.progressReports || [];
  const lines = [
    `Project: ${project.title}`,
    `PI: ${userDisplayName(project.researcherId)}`,
    `Status: ${project.status}`,
    `Period: ${project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"} – ${project.endDate ? new Date(project.endDate).toLocaleDateString() : "—"}`,
    "",
    "Progress reports:",
    ...(reports.length
      ? reports.map((r, i) => `${i + 1}. ${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"} — ${r.note || "—"} (${r.progressPercent ?? "—"}%)`)
      : ["No progress reports submitted yet."]),
    "",
    `Generated: ${new Date().toISOString()}`,
  ];

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

  const project = await Project.findOne(req.tierWhere({ _id: req.params.id }));
  if (!project) throw new AppError("Project not found", 404);

  const isOwner = String(project.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "faculty_coordinator", "finance_officer", "procurement_officer", "hr_officer"].includes(req.user.role);
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
    teamMembers: [],
    milestones: [],
    status: "active",
    progressReports: [],
  }));

  const created = await Project.findById(project._id).populate(PROJECT_POPULATE);
  res.status(201).json({ message: "Project created", project: sanitizeProject(created) });
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
  exportTechnicalReportPdf,
  addCommunicationLog,
  backfillProjectFromApprovedProposal,
};

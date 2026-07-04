const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Project } = require("../models/Project");
const { AppError } = require("../utils/AppError");
const { ensureBudgetForGrant } = require("../utils/ensureBudgetForGrant");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");
const { recordAudit } = require("../utils/audit");

function sanitizeGrant(g) {
  const researcherRef = g.researcherId;
  const projectRef = g.projectId;
  const callRef = g.callId;
  const out = {
    id: g._id,
    title: g.title,
    fundingSource: g.fundingSource,
    donorRef: g.donorRef,
    currency: g.currency,
    amountRequested: g.amountRequested,
    amountAwarded: g.amountAwarded,
    status: g.status,
    complianceNotes: g.complianceNotes,
    researcherId: researcherRef?._id ? String(researcherRef._id) : researcherRef,
    projectId: projectRef?._id ? String(projectRef._id) : projectRef || null,
    callId: callRef?._id ? String(callRef._id) : callRef || null,
    financeApprovedAt: g.financeApprovedAt,
    financeComment: g.financeComment,
    submittedAt: g.submittedAt,
    decidedAt: g.decidedAt,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    programTier: g.programTier,
  };
  if (projectRef?._id) out.project = sanitizeProjectSummary(projectRef);
  if (callRef?._id) {
    out.fundingCall = { id: callRef._id, title: callRef.title, status: callRef.status };
  }
  return out;
}

async function resolveGrantProjectId(req, projectId, researcherId) {
  if (!projectId) {
    throw new AppError("projectId is required — select your research project for this grant", 400);
  }
  const project = await Project.findOne(req.tierWhere({ _id: projectId, researcherId }));
  if (!project) throw new AppError("Research project not found or does not belong to you", 404);
  return project._id;
}

async function resolveOpenCall(req, callId) {
  if (!callId) return null;
  const call = await FundingCall.findOne(req.tierWhere({ _id: callId, status: CALL_STATUSES.OPEN }));
  if (!call) throw new AppError("Funding call not found or not open", 404);
  if (call.deadline && new Date(call.deadline) < new Date()) {
    throw new AppError("Funding call deadline has passed", 400);
  }
  return call;
}

function sanitizeResearcherProfile(user) {
  if (!user || !user._id) return null;
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    department: user.department,
    rank: user.rank,
    researchInterests: user.researchInterests || "",
  };
}

function sanitizeProjectSummary(project) {
  if (!project || !project._id) return null;
  return {
    id: project._id,
    title: project.title,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
  };
}

function sanitizeGrantDetail(g) {
  const base = sanitizeGrant(g);
  return {
    ...base,
    researcher: sanitizeResearcherProfile(g.researcherId),
    project: sanitizeProjectSummary(g.projectId),
  };
}

async function listGrants(req, res) {
  const { role } = req.user;
  const { status, projectId, callId } = req.query || {};
  const filter = {};
  if (status && Object.values(GRANT_STATUSES).includes(status)) filter.status = status;
  if (projectId) {
    const { validateProjectQuery } = require("../utils/projectScopedRecords");
    await validateProjectQuery(req, projectId, { ownerOnly: role === "researcher" });
    filter.projectId = projectId;
  }
  if (callId) filter.callId = callId;
  if (role === "researcher") filter.researcherId = req.user.id;

  const grants = await Grant.find(req.tierWhere(filter))
    .sort({ createdAt: -1 })
    .populate("projectId", "title status")
    .populate("callId", "title status");
  res.json({ grants: grants.map(sanitizeGrant) });
}

async function getGrant(req, res) {
  const grant = await Grant.findOne(req.tierWhere({ _id: req.params.id }))
    .populate("researcherId", "fullName email department rank researchInterests")
    .populate("projectId", "title status startDate endDate")
    .populate("callId", "title status fundingSource amountCap deadline");
  if (!grant) throw new AppError("Grant not found", 404);

  const isOwner = String(grant.researcherId?._id || grant.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "finance_officer", "faculty_coordinator"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ grant: sanitizeGrantDetail(grant) });
}

async function createGrant(req, res) {
  const { title, fundingSource, amountRequested, currency, donorRef, complianceNotes, projectId, callId } = req.body || {};
  if (!title) throw new AppError("title is required", 400);
  if (typeof amountRequested !== "number" || amountRequested < 0) {
    throw new AppError("amountRequested must be a non-negative number", 400);
  }

  const linkedProjectId = await resolveGrantProjectId(req, projectId, req.user.id);
  const call = await resolveOpenCall(req, callId);
  const source = call ? call.fundingSource : fundingSource;
  if (!source) throw new AppError("fundingSource is required when not applying to a call", 400);

  const grant = await Grant.create(req.tierAssign({
    title: String(title).trim(),
    fundingSource: String(source).trim(),
    amountRequested,
    currency: currency ? String(currency).trim().toUpperCase() : call?.currency || "USD",
    donorRef: donorRef ? String(donorRef).trim() : call?.donorRef || "",
    complianceNotes: complianceNotes ? String(complianceNotes) : "",
    projectId: linkedProjectId,
    callId: call?._id || null,
    researcherId: req.user.id,
    status: GRANT_STATUSES.DRAFT,
  }));

  await recordAudit({
    entityType: "grant",
    entityId: grant._id,
    action: "created",
    label: "Grant application created",
    detail: grant.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  const populated = await Grant.findById(grant._id).populate("projectId", "title status").populate("callId", "title status");
  res.status(201).json({ grant: sanitizeGrant(populated) });
}

async function updateGrant(req, res) {
  const grant = await Grant.findOne(req.tierWhere({ _id: req.params.id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (String(grant.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (![GRANT_STATUSES.DRAFT, GRANT_STATUSES.REJECTED].includes(grant.status)) {
    throw new AppError("Only draft or rejected grants can be edited", 400);
  }

  const { title, fundingSource, amountRequested, currency, donorRef, complianceNotes, projectId, callId } = req.body || {};
  if (title !== undefined) grant.title = String(title).trim();
  if (amountRequested !== undefined) {
    if (typeof amountRequested !== "number" || amountRequested < 0) throw new AppError("Invalid amountRequested", 400);
    grant.amountRequested = amountRequested;
  }
  if (currency !== undefined) grant.currency = String(currency).trim().toUpperCase();
  if (donorRef !== undefined) grant.donorRef = String(donorRef).trim();
  if (complianceNotes !== undefined) grant.complianceNotes = String(complianceNotes);
  if (projectId !== undefined) {
    grant.projectId = await resolveGrantProjectId(req, projectId, req.user.id);
  }
  if (callId !== undefined) {
    if (!callId) {
      grant.callId = null;
      if (fundingSource !== undefined) grant.fundingSource = String(fundingSource).trim();
    } else {
      const call = await resolveOpenCall(req, callId);
      grant.callId = call._id;
      grant.fundingSource = call.fundingSource;
      grant.donorRef = call.donorRef || grant.donorRef;
    }
  } else if (fundingSource !== undefined && !grant.callId) {
    grant.fundingSource = String(fundingSource).trim();
  }

  await grant.save();
  const populated = await Grant.findById(grant._id).populate("projectId", "title status").populate("callId", "title status");
  res.json({ grant: sanitizeGrant(populated) });
}

async function submitGrant(req, res) {
  const grant = await Grant.findOne(req.tierWhere({ _id: req.params.id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (String(grant.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (!grant.projectId) throw new AppError("Link a research project before submitting this grant", 400);
  if (grant.status !== GRANT_STATUSES.DRAFT) throw new AppError("Only draft grants can be submitted", 400);

  grant.status = GRANT_STATUSES.SUBMITTED;
  grant.submittedAt = new Date();
  await grant.save();

  try {
    await notifyUsersByRole("research_director", {
      type: "grant",
      title: "Grant submitted for review",
      body: grant.title,
      link: "/grants",
    }, req.programTier);
  } catch { /* best-effort */ }

  await recordAudit({
    entityType: "grant",
    entityId: grant._id,
    action: "submitted",
    label: "Grant submitted",
    detail: grant.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Grant submitted", grant: sanitizeGrant(grant) });
}

async function directorDecision(req, res) {
  const { decision, amountAwarded, complianceNotes } = req.body || {};
  if (![GRANT_STATUSES.APPROVED, GRANT_STATUSES.REJECTED].includes(decision)) {
    throw new AppError("Invalid decision", 400);
  }

  const grant = await Grant.findOne(req.tierWhere({ _id: req.params.id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (grant.status !== GRANT_STATUSES.SUBMITTED) throw new AppError("Grant is not decision-ready", 400);

  grant.decidedAt = new Date();
  if (decision === GRANT_STATUSES.REJECTED) {
    grant.status = GRANT_STATUSES.REJECTED;
  } else {
    let awarded = Number(amountAwarded);
    if (!Number.isFinite(awarded) || awarded < 0) throw new AppError("amountAwarded required", 400);
    if (awarded === 0) awarded = Number(grant.amountRequested || 0);
    if (awarded <= 0) throw new AppError("amountAwarded must be greater than zero", 400);
    grant.amountAwarded = awarded;
    grant.status = GRANT_STATUSES.PENDING_FINANCE;
  }
  if (complianceNotes !== undefined) grant.complianceNotes = String(complianceNotes);
  await grant.save();

  try {
    await notifyUser(grant.researcherId, {
      type: "grant",
      title: decision === GRANT_STATUSES.APPROVED ? "Grant approved — pending finance" : "Grant rejected",
      body: grant.title,
      link: "/grants",
      programTier: req.programTier,
    });
    if (decision === GRANT_STATUSES.APPROVED) {
      await notifyUsersByRole("finance_officer", {
        type: "grant",
        title: "Grant pending finance approval",
        body: grant.title,
        link: "/grants",
      }, req.programTier);
    }
  } catch { /* best-effort */ }

  await recordAudit({
    entityType: "grant",
    entityId: grant._id,
    action: decision === GRANT_STATUSES.APPROVED ? "director_approved" : "director_rejected",
    label: `Director ${decision === GRANT_STATUSES.APPROVED ? "approved" : "rejected"} grant`,
    detail: grant.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Decision saved", grant: sanitizeGrant(grant) });
}

async function financeDecision(req, res) {
  const { decision, comment } = req.body || {};
  if (!["approve", "reject"].includes(decision)) throw new AppError("Invalid decision", 400);

  const grant = await Grant.findOne(req.tierWhere({ _id: req.params.id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (grant.status !== GRANT_STATUSES.PENDING_FINANCE) {
    throw new AppError("Grant is not pending finance approval", 400);
  }

  grant.financeComment = comment ? String(comment) : "";
  grant.financeApprovedBy = req.user.id;
  grant.financeApprovedAt = new Date();

  let budgetResult = null;
  if (decision === "approve") {
    grant.status = GRANT_STATUSES.ACTIVE;
    await grant.save();
    budgetResult = await ensureBudgetForGrant(grant);
    try {
      await notifyUser(grant.researcherId, {
        type: "grant",
        title: "Grant activated — budget ready",
        body: grant.title,
        link: "/budgets",
        programTier: req.programTier,
      });
    } catch { /* best-effort */ }
  } else {
    grant.status = GRANT_STATUSES.REJECTED;
    await grant.save();
    try {
      await notifyUser(grant.researcherId, {
        type: "grant",
        title: "Grant rejected by finance",
        body: grant.title,
        link: "/grants",
        programTier: req.programTier,
      });
    } catch { /* best-effort */ }
  }

  await recordAudit({
    entityType: "grant",
    entityId: grant._id,
    action: decision === "approve" ? "finance_approved" : "finance_rejected",
    label: `Finance ${decision === "approve" ? "approved" : "rejected"} grant`,
    detail: grant.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({
    message: "Finance decision saved",
    grant: sanitizeGrant(grant),
    budget: budgetResult?.budget ? { id: budgetResult.budget._id, created: budgetResult.created } : null,
  });
}

module.exports = {
  listGrants,
  getGrant,
  createGrant,
  updateGrant,
  submitGrant,
  directorDecision,
  financeDecision,
};

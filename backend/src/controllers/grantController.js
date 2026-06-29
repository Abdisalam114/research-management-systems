const fs = require("fs");
const path = require("path");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Project } = require("../models/Project");
const { AppError } = require("../utils/AppError");
const { ensureBudgetForGrant } = require("../utils/ensureBudgetForGrant");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");

function agentLog(location, message, data, hypothesisId) {
  // #region agent log
  try {
    fs.appendFileSync(
      path.resolve(__dirname, "../../../debug-6113cc.log"),
      `${JSON.stringify({
        sessionId: "6113cc",
        location,
        message,
        data,
        hypothesisId,
        timestamp: Date.now(),
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion
}

function sanitizeGrant(g) {
  const researcherRef = g.researcherId;
  const projectRef = g.projectId;
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
    submittedAt: g.submittedAt,
    decidedAt: g.decidedAt,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    programTier: g.programTier,
  };
  if (projectRef?._id) {
    out.project = sanitizeProjectSummary(projectRef);
  }
  return out;
}

async function resolveGrantProjectId(req, projectId, researcherId) {
  if (!projectId) {
    throw new AppError("projectId is required — select your research project for this grant", 400);
  }
  const project = await Project.findOne(
    req.tierWhere({ _id: projectId, researcherId })
  );
  if (!project) {
    throw new AppError("Research project not found or does not belong to you", 404);
  }
  return project._id;
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
  const { status, projectId } = req.query || {};

  const filter = {};
  if (status && Object.values(GRANT_STATUSES).includes(status)) filter.status = status;
  if (projectId) {
    const { validateProjectQuery } = require("../utils/projectScopedRecords");
    await validateProjectQuery(req, projectId, { ownerOnly: role === "researcher" });
    filter.projectId = projectId;
  }

  if (role === "researcher") filter.researcherId = req.user.id;
  // finance_officer, faculty_coordinator, research_director can view all (MVP baseline)

  const grants = await Grant.find(req.tierWhere(filter))
    .sort({ createdAt: -1 })
    .populate("projectId", "title status");
  res.json({ grants: grants.map(sanitizeGrant) });
}

async function getGrant(req, res) {
  const { id } = req.params;
  const grant = await Grant.findOne(req.tierWhere({ _id: id }))
    .populate("researcherId", "fullName email department rank researchInterests")
    .populate("projectId", "title status startDate endDate");
  if (!grant) throw new AppError("Grant not found", 404);

  const isOwner = String(grant.researcherId?._id || grant.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "finance_officer", "faculty_coordinator"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ grant: sanitizeGrantDetail(grant) });
}

async function createGrant(req, res) {
  const { title, fundingSource, amountRequested, currency, donorRef, complianceNotes, projectId } = req.body || {};
  if (!title || !fundingSource) throw new AppError("title and fundingSource are required", 400);
  if (typeof amountRequested !== "number" || amountRequested < 0) {
    throw new AppError("amountRequested must be a non-negative number", 400);
  }

  const linkedProjectId = await resolveGrantProjectId(req, projectId, req.user.id);

  const grant = await Grant.create(req.tierAssign({
    title: String(title).trim(),
    fundingSource: String(fundingSource).trim(),
    amountRequested,
    currency: currency ? String(currency).trim().toUpperCase() : "USD",
    donorRef: donorRef ? String(donorRef).trim() : "",
    complianceNotes: complianceNotes ? String(complianceNotes) : "",
    projectId: linkedProjectId,
    researcherId: req.user.id,
    status: GRANT_STATUSES.DRAFT,
  }));

  const populated = await Grant.findById(grant._id).populate("projectId", "title status");
  res.status(201).json({ grant: sanitizeGrant(populated) });
}

async function updateGrant(req, res) {
  const { id } = req.params;
  const grant = await Grant.findOne(req.tierWhere({ _id: id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (String(grant.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);

  if (![GRANT_STATUSES.DRAFT, GRANT_STATUSES.REJECTED].includes(grant.status)) {
    throw new AppError("Only draft or rejected grants can be edited", 400);
  }

  const { title, fundingSource, amountRequested, currency, donorRef, complianceNotes, projectId } = req.body || {};
  if (title !== undefined) grant.title = String(title).trim();
  if (fundingSource !== undefined) grant.fundingSource = String(fundingSource).trim();
  if (amountRequested !== undefined) {
    if (typeof amountRequested !== "number" || amountRequested < 0) throw new AppError("Invalid amountRequested", 400);
    grant.amountRequested = amountRequested;
  }
  if (currency !== undefined) grant.currency = String(currency).trim().toUpperCase();
  if (donorRef !== undefined) grant.donorRef = String(donorRef).trim();
  if (complianceNotes !== undefined) grant.complianceNotes = String(complianceNotes);
  if (projectId !== undefined) {
    if (projectId === null || projectId === "") {
      throw new AppError("projectId cannot be removed — link a research project", 400);
    }
    grant.projectId = await resolveGrantProjectId(req, projectId, req.user.id);
  }

  await grant.save();
  const populated = await Grant.findById(grant._id).populate("projectId", "title status");
  res.json({ grant: sanitizeGrant(populated) });
}

async function submitGrant(req, res) {
  const { id } = req.params;
  const grant = await Grant.findOne(req.tierWhere({ _id: id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (String(grant.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  if (!grant.projectId) {
    throw new AppError("Link a research project before submitting this grant", 400);
  }
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
  } catch {
    /* notifications are best-effort */
  }

  res.json({ message: "Grant submitted", grant: sanitizeGrant(grant) });
}

async function directorDecision(req, res) {
  const { id } = req.params;
  const { decision, amountAwarded, complianceNotes } = req.body || {};
  agentLog("grantController.js:directorDecision:entry", "director decision request", {
    grantId: id,
    decision,
    amountAwarded,
    amountAwardedType: typeof amountAwarded,
  }, "C,D");
  if (![GRANT_STATUSES.APPROVED, GRANT_STATUSES.REJECTED].includes(decision)) {
    throw new AppError("Invalid decision", 400);
  }

  const grant = await Grant.findOne(req.tierWhere({ _id: id }));
  if (!grant) throw new AppError("Grant not found", 404);
  if (![GRANT_STATUSES.SUBMITTED].includes(grant.status)) throw new AppError("Grant is not decision-ready", 400);

  grant.status = decision;
  grant.decidedAt = new Date();
  if (decision === GRANT_STATUSES.APPROVED) {
    let awarded = Number(amountAwarded);
    if (!Number.isFinite(awarded) || awarded < 0) throw new AppError("amountAwarded required", 400);
    if (awarded === 0) awarded = Number(grant.amountRequested || 0);
    if (awarded <= 0) throw new AppError("amountAwarded must be greater than zero", 400);
    grant.amountAwarded = awarded;
    grant.status = GRANT_STATUSES.ACTIVE;
  }
  if (complianceNotes !== undefined) grant.complianceNotes = String(complianceNotes);

  await grant.save();
  agentLog("grantController.js:directorDecision:exit", "decision saved", {
    grantId: id,
    finalStatus: grant.status,
    amountAwarded: grant.amountAwarded,
  }, "A,C,D");

  let budgetResult = null;
  if (decision === GRANT_STATUSES.APPROVED) {
    budgetResult = await ensureBudgetForGrant(grant);
  }

  try {
    await notifyUser(grant.researcherId, {
      type: "grant",
      title: `Grant ${decision === GRANT_STATUSES.APPROVED ? "approved" : "rejected"}`,
      body: grant.title,
      link: decision === GRANT_STATUSES.APPROVED ? "/budgets" : "/grants",
      programTier: req.programTier,
    });
    if (budgetResult?.created) {
      await notifyUsersByRole("finance_officer", {
        type: "budget",
        title: "New budget from grant award",
        body: `${grant.title} — ${grant.currency || "USD"} ${Number(grant.amountAwarded || 0).toLocaleString()}`,
        link: "/budgets",
      }, req.programTier);
    }
  } catch {
    /* notifications are best-effort */
  }

  res.json({
    message: "Decision saved",
    grant: sanitizeGrant(grant),
    budget: budgetResult?.budget ? { id: budgetResult.budget._id, created: budgetResult.created } : null,
  });
}

module.exports = { listGrants, getGrant, createGrant, updateGrant, submitGrant, directorDecision };


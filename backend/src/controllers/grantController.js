const fs = require("fs");
const path = require("path");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { AppError } = require("../utils/AppError");
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
  return {
    id: g._id,
    title: g.title,
    fundingSource: g.fundingSource,
    donorRef: g.donorRef,
    currency: g.currency,
    amountRequested: g.amountRequested,
    amountAwarded: g.amountAwarded,
    status: g.status,
    complianceNotes: g.complianceNotes,
    researcherId: g.researcherId,
    projectId: g.projectId,
    submittedAt: g.submittedAt,
    decidedAt: g.decidedAt,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  };
}

async function listGrants(req, res) {
  const { role } = req.user;
  const { status } = req.query || {};

  const filter = {};
  if (status && Object.values(GRANT_STATUSES).includes(status)) filter.status = status;

  if (role === "researcher") filter.researcherId = req.user.id;
  // finance_officer, faculty_coordinator, research_director can view all (MVP baseline)

  const grants = await Grant.find(filter).sort({ createdAt: -1 });
  res.json({ grants: grants.map(sanitizeGrant) });
}

async function getGrant(req, res) {
  const { id } = req.params;
  const grant = await Grant.findById(id);
  if (!grant) throw new AppError("Grant not found", 404);

  const isOwner = String(grant.researcherId) === String(req.user.id);
  const isStaff = ["research_director", "finance_officer", "faculty_coordinator"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ grant: sanitizeGrant(grant) });
}

async function createGrant(req, res) {
  const { title, fundingSource, amountRequested, currency, donorRef, complianceNotes, projectId } = req.body || {};
  if (!title || !fundingSource) throw new AppError("title and fundingSource are required", 400);
  if (typeof amountRequested !== "number" || amountRequested < 0) {
    throw new AppError("amountRequested must be a non-negative number", 400);
  }

  const grant = await Grant.create({
    title: String(title).trim(),
    fundingSource: String(fundingSource).trim(),
    amountRequested,
    currency: currency ? String(currency).trim().toUpperCase() : "USD",
    donorRef: donorRef ? String(donorRef).trim() : "",
    complianceNotes: complianceNotes ? String(complianceNotes) : "",
    projectId: projectId || null,
    researcherId: req.user.id,
    status: GRANT_STATUSES.DRAFT,
  });

  res.status(201).json({ grant: sanitizeGrant(grant) });
}

async function updateGrant(req, res) {
  const { id } = req.params;
  const grant = await Grant.findById(id);
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
  if (projectId !== undefined) grant.projectId = projectId || null;

  await grant.save();
  res.json({ grant: sanitizeGrant(grant) });
}

async function submitGrant(req, res) {
  const { id } = req.params;
  const grant = await Grant.findById(id);
  if (!grant) throw new AppError("Grant not found", 404);
  if (String(grant.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
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
    });
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

  const grant = await Grant.findById(id);
  if (!grant) throw new AppError("Grant not found", 404);
  if (![GRANT_STATUSES.SUBMITTED].includes(grant.status)) throw new AppError("Grant is not decision-ready", 400);

  grant.status = decision;
  grant.decidedAt = new Date();
  if (decision === GRANT_STATUSES.APPROVED) {
    const awarded = Number(amountAwarded);
    if (!Number.isFinite(awarded) || awarded < 0) throw new AppError("amountAwarded required", 400);
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

  try {
    await notifyUser(grant.researcherId, {
      type: "grant",
      title: `Grant ${decision === GRANT_STATUSES.APPROVED ? "approved" : "rejected"}`,
      body: grant.title,
      link: "/grants",
    });
  } catch {
    /* notifications are best-effort */
  }

  res.json({ message: "Decision saved", grant: sanitizeGrant(grant) });
}

module.exports = { listGrants, getGrant, createGrant, updateGrant, submitGrant, directorDecision };


const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { AppError } = require("../utils/AppError");
const { notifyUsersByRole, notifyUser } = require("../utils/notify");
const { recordAudit } = require("../utils/audit");
const { tierMatchesCall } = require("../utils/fundingCallEligibility");

function sanitizeCall(c) {
  return {
    id: c._id,
    title: c.title,
    description: c.description,
    fundingSource: c.fundingSource,
    callType: c.callType || "internal",
    donorRef: c.donorRef,
    amountCap: c.amountCap,
    currency: c.currency,
    deadline: c.deadline,
    eligibilityTier: c.eligibilityTier,
    requiredDocuments: c.requiredDocuments,
    status: c.status,
    publishedAt: c.publishedAt,
    closedAt: c.closedAt,
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    programTier: c.programTier,
  };
}

function isCallOwner(call, userId) {
  return String(call.createdBy) === String(userId);
}

async function listFundingCalls(req, res) {
  const { status } = req.query || {};
  const filter = {};
  if (status && Object.values(CALL_STATUSES).includes(status)) filter.status = status;

  if (req.user.role === "researcher") {
    filter.status = CALL_STATUSES.OPEN;
  }

  // Donor sees external calls (all statuses) + open internal for awareness
  if (req.user.role === "donor_agency") {
    filter.$or = [
      { callType: "external" },
      { status: CALL_STATUSES.OPEN, callType: "internal" },
    ];
  }

  const calls = await FundingCall.find(req.tierWhere(filter)).sort({ deadline: 1, createdAt: -1 });
  const visible = req.user.role === "researcher"
    ? calls.filter((c) => tierMatchesCall(req, c) && (!c.deadline || new Date(c.deadline) >= new Date()))
    : calls;

  res.json({ calls: visible.map(sanitizeCall) });
}

async function getFundingCall(req, res) {
  const call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  if (!call) throw new AppError("Funding call not found", 404);
  if (req.user.role === "researcher") {
    if (call.status !== CALL_STATUSES.OPEN) throw new AppError("Funding call not available", 404);
    if (!tierMatchesCall(req, call)) throw new AppError("Not eligible for this call", 403);
  }
  if (req.user.role === "donor_agency" && call.callType !== "external" && call.status !== CALL_STATUSES.OPEN) {
    throw new AppError("Forbidden", 403);
  }
  res.json({ call: sanitizeCall(call) });
}

async function createFundingCall(req, res) {
  const {
    title, description, fundingSource, callType, donorRef, amountCap, currency,
    deadline, eligibilityTier, requiredDocuments,
  } = req.body || {};
  if (!title || !fundingSource) throw new AppError("title and fundingSource are required", 400);

  const role = req.user.role;
  let resolvedType = callType === "external" ? "external" : "internal";

  if (role === "donor_agency") {
    resolvedType = "external";
  } else if (role === "research_director") {
    // Director creates internal institutional calls only
    if (resolvedType === "external") {
      throw new AppError("External funding calls are created by the Donor Agency. Use call type Internal.", 400);
    }
    resolvedType = "internal";
  } else {
    throw new AppError("Forbidden", 403);
  }

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    fs.appendFileSync(
      path.join(process.cwd(), "..", "debug-f558f7.log"),
      `${JSON.stringify({
        sessionId: "f558f7",
        hypothesisId: "A",
        location: "fundingCallController.js:createFundingCall",
        message: "create funding call role/type resolution",
        data: { role, requestedType: callType || null, resolvedType },
        timestamp: Date.now(),
        runId: "pre-fix",
      })}\n`
    );
  } catch { /* ignore */ }
  // #endregion

  if (resolvedType === "external" && !(donorRef || "").trim()) {
    throw new AppError("Donor / agency reference is required for external funding calls", 400);
  }

  const call = await FundingCall.create(req.tierAssign({
    title: String(title).trim(),
    description: description ? String(description) : "",
    fundingSource: String(fundingSource).trim(),
    callType: resolvedType,
    donorRef: donorRef ? String(donorRef).trim() : "",
    amountCap: typeof amountCap === "number" ? amountCap : Number(amountCap) || 0,
    currency: currency ? String(currency).trim().toUpperCase() : "USD",
    deadline: deadline ? new Date(deadline) : null,
    eligibilityTier: eligibilityTier || "all",
    requiredDocuments: requiredDocuments ? String(requiredDocuments) : "",
    status: CALL_STATUSES.DRAFT,
    createdBy: req.user.id,
  }));

  await recordAudit({
    entityType: "funding_call",
    entityId: call._id,
    action: "created",
    label: resolvedType === "external" ? "External funding call draft created" : "Internal funding call draft created",
    detail: call.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  try {
    await notifyUsersByRole("leadership", {
      type: "grant",
      title: "Funding call awaiting approval",
      body: `${call.title} (${resolvedType}) — ready for Leadership to approve/publish`,
      link: "/funding-calls",
    }, req.programTier);
  } catch { /* best-effort */ }

  res.status(201).json({ call: sanitizeCall(call) });
}

async function updateFundingCall(req, res) {
  const call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  if (!call) throw new AppError("Funding call not found", 404);
  if (call.status !== CALL_STATUSES.DRAFT) throw new AppError("Only draft calls can be edited", 400);

  const role = req.user.role;
  if (role === "donor_agency") {
    if (call.callType !== "external") throw new AppError("Donors may only edit external funding calls", 403);
    if (!isCallOwner(call, req.user.id)) throw new AppError("You can only edit funding calls you created", 403);
  } else if (role === "research_director") {
    if (call.callType === "external") throw new AppError("External calls are managed by the Donor Agency", 403);
  } else if (role !== "leadership") {
    throw new AppError("Forbidden", 403);
  }

  const fields = ["title", "description", "fundingSource", "donorRef", "amountCap", "currency", "deadline", "eligibilityTier", "requiredDocuments"];
  for (const f of fields) {
    if (req.body?.[f] !== undefined) {
      if (f === "deadline") call.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
      else if (f === "amountCap") call.amountCap = Number(req.body.amountCap) || 0;
      else if (f === "currency") call.currency = String(req.body.currency).trim().toUpperCase();
      else call[f] = String(req.body[f]).trim();
    }
  }

  // callType is locked by role — donor stays external, director stays internal
  if (role === "donor_agency") call.callType = "external";
  if (role === "research_director") call.callType = "internal";

  if (call.callType === "external" && !(call.donorRef || "").trim()) {
    throw new AppError("Donor / agency reference is required for external funding calls", 400);
  }

  await call.save();
  res.json({ call: sanitizeCall(call) });
}

/** Leadership (and Director for internal) approve & publish a draft call */
async function publishFundingCall(req, res) {
  const call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  if (!call) throw new AppError("Funding call not found", 404);
  if (call.status !== CALL_STATUSES.DRAFT) throw new AppError("Only draft calls can be published", 400);

  const role = req.user.role;
  const canPublish =
    role === "leadership" || (role === "research_director" && call.callType === "internal");

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    fs.appendFileSync(
      path.join(process.cwd(), "..", "debug-f558f7.log"),
      `${JSON.stringify({
        sessionId: "f558f7",
        hypothesisId: "C",
        location: "fundingCallController.js:publishFundingCall",
        message: "publish funding call authorization",
        data: { role, callType: call.callType, callStatus: call.status, canPublish },
        timestamp: Date.now(),
        runId: "pre-fix",
      })}\n`
    );
  } catch { /* ignore */ }
  // #endregion

  if (!canPublish) {
    throw new AppError("Only Leadership can approve funding calls for publication (Director may publish internal calls)", 403);
  }

  call.status = CALL_STATUSES.OPEN;
  call.publishedAt = new Date();
  await call.save();

  try {
    await notifyUsersByRole("researcher", {
      type: "grant",
      title: "New funding call published",
      body: call.title,
      link: "/funding-calls",
    }, req.programTier);
    if (call.createdBy) {
      await notifyUser(call.createdBy, {
        type: "grant",
        title: "Funding call approved & published",
        body: call.title,
        link: "/funding-calls",
        programTier: req.programTier,
      });
    }
  } catch { /* best-effort */ }

  await recordAudit({
    entityType: "funding_call",
    entityId: call._id,
    action: "published",
    label: "Funding call approved/published",
    detail: call.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Funding call approved and published", call: sanitizeCall(call) });
}

async function closeFundingCall(req, res) {
  const call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  if (!call) throw new AppError("Funding call not found", 404);
  if (call.status !== CALL_STATUSES.OPEN) throw new AppError("Only open calls can be closed", 400);

  const role = req.user.role;
  const allowed =
    role === "leadership" ||
    role === "research_director" ||
    (role === "donor_agency" && call.callType === "external" && isCallOwner(call, req.user.id));
  if (!allowed) throw new AppError("Forbidden", 403);

  call.status = CALL_STATUSES.CLOSED;
  call.closedAt = new Date();
  await call.save();

  await recordAudit({
    entityType: "funding_call",
    entityId: call._id,
    action: "closed",
    label: "Funding call closed",
    detail: call.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Funding call closed", call: sanitizeCall(call) });
}

module.exports = {
  listFundingCalls,
  getFundingCall,
  createFundingCall,
  updateFundingCall,
  publishFundingCall,
  closeFundingCall,
};

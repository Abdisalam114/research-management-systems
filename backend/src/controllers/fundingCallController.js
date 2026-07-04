const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { AppError } = require("../utils/AppError");
const { notifyUsersByRole } = require("../utils/notify");
const { recordAudit } = require("../utils/audit");

function sanitizeCall(c) {
  return {
    id: c._id,
    title: c.title,
    description: c.description,
    fundingSource: c.fundingSource,
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

function tierMatchesCall(req, call) {
  if (call.eligibilityTier === "all") return true;
  const pt = req.programTier === "undergraduate" ? "ug" : "pg";
  if (call.eligibilityTier === "ug") return pt === "ug";
  if (call.eligibilityTier === "pg" || call.eligibilityTier === "pgd") return pt === "pg";
  return true;
}

async function listFundingCalls(req, res) {
  const { status } = req.query || {};
  const filter = {};
  if (status && Object.values(CALL_STATUSES).includes(status)) filter.status = status;

  if (req.user.role === "researcher") {
    filter.status = CALL_STATUSES.OPEN;
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
  res.json({ call: sanitizeCall(call) });
}

async function createFundingCall(req, res) {
  const {
    title, description, fundingSource, donorRef, amountCap, currency,
    deadline, eligibilityTier, requiredDocuments,
  } = req.body || {};
  if (!title || !fundingSource) throw new AppError("title and fundingSource are required", 400);

  const call = await FundingCall.create(req.tierAssign({
    title: String(title).trim(),
    description: description ? String(description) : "",
    fundingSource: String(fundingSource).trim(),
    donorRef: donorRef ? String(donorRef).trim() : "",
    amountCap: typeof amountCap === "number" ? amountCap : 0,
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
    label: "Funding call created",
    detail: call.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.status(201).json({ call: sanitizeCall(call) });
}

async function updateFundingCall(req, res) {
  const call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  if (!call) throw new AppError("Funding call not found", 404);
  if (call.status !== CALL_STATUSES.DRAFT) throw new AppError("Only draft calls can be edited", 400);

  const fields = ["title", "description", "fundingSource", "donorRef", "amountCap", "currency", "deadline", "eligibilityTier", "requiredDocuments"];
  for (const f of fields) {
    if (req.body?.[f] !== undefined) {
      if (f === "deadline") call.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
      else if (f === "amountCap") call.amountCap = Number(req.body.amountCap) || 0;
      else if (f === "currency") call.currency = String(req.body.currency).trim().toUpperCase();
      else call[f] = String(req.body[f]).trim();
    }
  }
  await call.save();
  res.json({ call: sanitizeCall(call) });
}

async function publishFundingCall(req, res) {
  const call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  if (!call) throw new AppError("Funding call not found", 404);
  if (call.status !== CALL_STATUSES.DRAFT) throw new AppError("Only draft calls can be published", 400);

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
  } catch { /* best-effort */ }

  await recordAudit({
    entityType: "funding_call",
    entityId: call._id,
    action: "published",
    label: "Funding call published",
    detail: call.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ message: "Funding call published", call: sanitizeCall(call) });
}

async function closeFundingCall(req, res) {
  const call = await FundingCall.findOne(req.tierWhere({ _id: req.params.id }));
  if (!call) throw new AppError("Funding call not found", 404);
  if (call.status !== CALL_STATUSES.OPEN) throw new AppError("Only open calls can be closed", 400);

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

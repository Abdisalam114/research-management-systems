const { InstitutionalPolicy } = require("../models/InstitutionalPolicy");
const { AppError } = require("../utils/AppError");
const { recordAudit } = require("../utils/audit");

function sanitize(p) {
  return {
    id: p._id,
    title: p.title,
    body: p.body,
    moduleKey: p.moduleKey,
    category: p.category,
    status: p.status,
    updatedBy: p.updatedBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    programTier: p.programTier,
  };
}

async function listPolicies(req, res) {
  const filter = {};
  // Non-leadership see published only
  if (req.user.role !== "leadership" && req.user.role !== "research_director") {
    filter.status = "published";
  }
  const policies = await InstitutionalPolicy.find(req.tierWhere(filter)).sort({ updatedAt: -1 });
  res.json({ policies: policies.map(sanitize) });
}

async function getPolicy(req, res) {
  const policy = await InstitutionalPolicy.findOne(req.tierWhere({ _id: req.params.id }));
  if (!policy) throw new AppError("Policy not found", 404);
  if (
    policy.status !== "published" &&
    !["leadership", "research_director"].includes(req.user.role)
  ) {
    throw new AppError("Forbidden", 403);
  }
  res.json({ policy: sanitize(policy) });
}

async function createPolicy(req, res) {
  const { title, body, category, status, moduleKey } = req.body || {};
  if (!title) throw new AppError("title is required", 400);
  if (!moduleKey) throw new AppError("moduleKey is required", 400);
  const { POLICY_MODULE_KEYS } = require("../constants/institutionalPolicyCatalog");
  if (!POLICY_MODULE_KEYS.includes(moduleKey)) throw new AppError("Invalid moduleKey", 400);

  const policy = await InstitutionalPolicy.create(req.tierAssign({
    title: String(title).trim(),
    body: body != null ? String(body) : "",
    moduleKey,
    category: ["research", "funding", "ethics", "general"].includes(category) ? category : "general",
    status: status === "draft" ? "draft" : "published",
    updatedBy: req.user.id,
  }));

  await recordAudit({
    entityType: "policy",
    entityId: policy._id,
    action: "created",
    label: "Institutional policy created",
    detail: policy.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.status(201).json({ policy: sanitize(policy) });
}

async function updatePolicy(req, res) {
  const policy = await InstitutionalPolicy.findOne(req.tierWhere({ _id: req.params.id }));
  if (!policy) throw new AppError("Policy not found", 404);

  if (req.body?.title !== undefined) policy.title = String(req.body.title).trim();
  if (req.body?.body !== undefined) policy.body = String(req.body.body);
  if (req.body?.moduleKey !== undefined) {
    const { POLICY_MODULE_KEYS } = require("../constants/institutionalPolicyCatalog");
    if (!POLICY_MODULE_KEYS.includes(req.body.moduleKey)) throw new AppError("Invalid moduleKey", 400);
    policy.moduleKey = req.body.moduleKey;
  }
  if (req.body?.category !== undefined && ["research", "funding", "ethics", "general"].includes(req.body.category)) {
    policy.category = req.body.category;
  }
  if (req.body?.status !== undefined) {
    policy.status = req.body.status === "draft" ? "draft" : "published";
  }
  policy.updatedBy = req.user.id;
  await policy.save();

  await recordAudit({
    entityType: "policy",
    entityId: policy._id,
    action: "updated",
    label: "Institutional policy updated",
    detail: policy.title,
    actorId: req.user.id,
    actorRole: req.user.role,
    programTier: req.programTier,
  });

  res.json({ policy: sanitize(policy) });
}

async function deletePolicy(req, res) {
  const policy = await InstitutionalPolicy.findOne(req.tierWhere({ _id: req.params.id }));
  if (!policy) throw new AppError("Policy not found", 404);
  await InstitutionalPolicy.deleteOne({ _id: policy._id });
  res.json({ message: "Policy deleted" });
}

module.exports = {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
};

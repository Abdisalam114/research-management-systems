const { ResearchPolicy, POLICY_TYPES, POLICY_STATUSES } = require("../models/ResearchPolicy");
const { AppError } = require("../utils/AppError");

function sanitize(p) {
  return {
    id: p._id,
    type: p.type,
    title: p.title,
    description: p.description,
    status: p.status,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

async function listPolicies(req, res) {
  const { type, status } = req.query || {};
  const filter = {};
  if (type && Object.values(POLICY_TYPES).includes(type)) filter.type = type;
  if (status && Object.values(POLICY_STATUSES).includes(status)) filter.status = status;

  const items = await ResearchPolicy.find(filter).sort({ updatedAt: -1 });
  res.json({ policies: items.map(sanitize) });
}

async function createPolicy(req, res) {
  const { type, title, description, status } = req.body;
  if (!type || !title) throw new AppError("type and title are required", 400);
  if (!Object.values(POLICY_TYPES).includes(type)) throw new AppError("Invalid type", 400);

  const item = await ResearchPolicy.create({
    type,
    title: String(title).trim(),
    description: description || "",
    status: status && Object.values(POLICY_STATUSES).includes(status) ? status : POLICY_STATUSES.DRAFT,
    createdBy: req.user.id,
  });

  res.status(201).json({ policy: sanitize(item) });
}

async function updatePolicy(req, res) {
  const { id } = req.params;
  const item = await ResearchPolicy.findById(id);
  if (!item) throw new AppError("Policy not found", 404);

  const { title, description, status, type } = req.body;
  if (type && Object.values(POLICY_TYPES).includes(type)) item.type = type;
  if (title) item.title = String(title).trim();
  if (description !== undefined) item.description = description;
  if (status && Object.values(POLICY_STATUSES).includes(status)) item.status = status;

  await item.save();
  res.json({ policy: sanitize(item) });
}

module.exports = { listPolicies, createPolicy, updatePolicy };

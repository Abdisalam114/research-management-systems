const { Budget, BUDGET_ITEM_STATUSES, BUDGET_ITEM_TYPES } = require("../models/Budget");
const { Grant } = require("../models/Grant");
const { AppError } = require("../utils/AppError");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");

function sanitizeBudget(b) {
  return {
    id: b._id,
    grantId: b.grantId,
    projectId: b.projectId,
    ownerResearcherId: b.ownerResearcherId,
    totalAllocated: b.totalAllocated,
    currency: b.currency,
    financeNotes: b.financeNotes,
    items: b.items,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

async function listBudgets(req, res) {
  const { role } = req.user;
  const filter = {};
  if (role === "researcher") filter.ownerResearcherId = req.user.id;
  // finance_officer / director can view all
  const budgets = await Budget.find(filter).sort({ createdAt: -1 });
  res.json({ budgets: budgets.map(sanitizeBudget) });
}

async function getBudget(req, res) {
  const { id } = req.params;
  const budget = await Budget.findById(id);
  if (!budget) throw new AppError("Budget not found", 404);

  const isOwner = String(budget.ownerResearcherId) === String(req.user.id);
  const isStaff = ["finance_officer", "research_director"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ budget: sanitizeBudget(budget) });
}

async function createBudget(req, res) {
  const { grantId, projectId, totalAllocated, currency } = req.body || {};
  if (!grantId && !projectId) throw new AppError("grantId or projectId is required", 400);

  // If grantId provided, ensure it exists and belongs to owner (or staff creating on behalf—kept simple: researcher only).
  if (grantId) {
    const grant = await Grant.findById(grantId);
    if (!grant) throw new AppError("Grant not found", 404);
    if (String(grant.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
  }

  const budget = await Budget.create({
    grantId: grantId || null,
    projectId: projectId || null,
    ownerResearcherId: req.user.id,
    totalAllocated: typeof totalAllocated === "number" && totalAllocated >= 0 ? totalAllocated : 0,
    currency: currency ? String(currency).trim().toUpperCase() : "USD",
    items: [],
  });

  res.status(201).json({ budget: sanitizeBudget(budget) });
}

async function addBudgetItem(req, res) {
  const { id } = req.params;
  const { type, description, amount } = req.body || {};
  if (!type || !description) throw new AppError("type and description are required", 400);
  if (!Object.values(BUDGET_ITEM_TYPES).includes(type)) throw new AppError("Invalid type", 400);
  if (typeof amount !== "number" || amount < 0) throw new AppError("amount must be a non-negative number", 400);

  const budget = await Budget.findById(id);
  if (!budget) throw new AppError("Budget not found", 404);
  if (String(budget.ownerResearcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);

  budget.items.unshift({
    type,
    description: String(description).trim(),
    amount,
    status: BUDGET_ITEM_STATUSES.PENDING,
    createdBy: req.user.id,
  });

  await budget.save();

  try {
    await notifyUsersByRole("finance_officer", {
      type: "budget",
      title: "New budget item pending",
      body: String(description).trim(),
      link: "/budgets",
    });
  } catch {
    /* notifications are best-effort */
  }

  res.json({ message: "Item added", budget: sanitizeBudget(budget) });
}

async function financeUpdateItemStatus(req, res) {
  const { id, itemId } = req.params;
  const { status, rejectedReason } = req.body || {};
  if (!Object.values(BUDGET_ITEM_STATUSES).includes(status)) throw new AppError("Invalid status", 400);

  const budget = await Budget.findById(id);
  if (!budget) throw new AppError("Budget not found", 404);

  const item = budget.items.id(itemId);
  if (!item) throw new AppError("Budget item not found", 404);

  if (status === BUDGET_ITEM_STATUSES.APPROVED) {
    item.status = status;
    item.approvedBy = req.user.id;
    item.rejectedReason = "";
  } else if (status === BUDGET_ITEM_STATUSES.PAID) {
    if (item.status !== BUDGET_ITEM_STATUSES.APPROVED) throw new AppError("Item must be approved before payment", 400);
    item.status = status;
    item.paidAt = new Date();
  } else if (status === BUDGET_ITEM_STATUSES.REJECTED) {
    item.status = status;
    item.rejectedReason = rejectedReason ? String(rejectedReason) : "Rejected";
  } else {
    item.status = status;
  }

  await budget.save();

  try {
    await notifyUser(budget.ownerResearcherId, {
      type: "budget",
      title: `Budget item ${status}`,
      body: item.description,
      link: "/budgets",
    });
  } catch {
    /* notifications are best-effort */
  }

  res.json({ message: "Item updated", budget: sanitizeBudget(budget) });
}

module.exports = { listBudgets, getBudget, createBudget, addBudgetItem, financeUpdateItemStatus };


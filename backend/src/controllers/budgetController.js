const { Budget, BUDGET_ITEM_STATUSES, BUDGET_ITEM_TYPES } = require("../models/Budget");
const { Grant } = require("../models/Grant");
const { Project } = require("../models/Project");
const { AppError } = require("../utils/AppError");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");
const { remainingOf } = require("../utils/budgetDisbursement");

function refId(ref) {
  if (!ref) return null;
  return ref._id ? String(ref._id) : String(ref);
}

function sanitizeBudget(b) {
  const grantRef = b.grantId;
  const projectRef = b.projectId;
  const out = {
    id: b._id,
    grantId: refId(grantRef),
    projectId: refId(projectRef),
    ownerResearcherId: refId(b.ownerResearcherId),
    totalAllocated: b.totalAllocated,
    totalDisbursed: b.totalDisbursed || 0,
    remainingBalance: remainingOf(b),
    currency: b.currency,
    financeNotes: b.financeNotes,
    items: b.items,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
  if (grantRef && typeof grantRef === "object" && grantRef._id) {
    out.grant = {
      id: grantRef._id,
      title: grantRef.title,
      fundingSource: grantRef.fundingSource,
      amountAwarded: grantRef.amountAwarded,
      status: grantRef.status,
    };
  }
  if (projectRef && typeof projectRef === "object" && projectRef._id) {
    out.project = {
      id: projectRef._id,
      title: projectRef.title,
      status: projectRef.status,
    };
  }
  return out;
}

async function reconcileDisbursedFromPaid(req, budgets) {
  if (!budgets.length) return;
  const { Payment, PAYMENT_STATUSES } = require("../models/Payment");
  const { PurchaseOrder, PO_STATUSES } = require("../models/PurchaseOrder");
  const ids = budgets.map((b) => b._id);
  const [payGroups, poGroups] = await Promise.all([
    Payment.aggregate([
      { $match: { ...req.tierWhere({ budgetId: { $in: ids } }), status: PAYMENT_STATUSES.PAID } },
      { $group: { _id: "$budgetId", total: { $sum: "$amount" } } },
    ]),
    PurchaseOrder.aggregate([
      { $match: { ...req.tierWhere({ budgetId: { $in: ids } }), status: PO_STATUSES.PAID } },
      { $group: { _id: "$budgetId", total: { $sum: "$totalAmount" } } },
    ]),
  ]);
  const paidMap = new Map();
  for (const g of payGroups) paidMap.set(String(g._id), Number(g.total || 0));
  for (const g of poGroups) {
    const k = String(g._id);
    paidMap.set(k, (paidMap.get(k) || 0) + Number(g.total || 0));
  }
  // Also count paid budget line items
  for (const b of budgets) {
    const itemPaid = (b.items || [])
      .filter((i) => i.status === BUDGET_ITEM_STATUSES.PAID)
      .reduce((a, i) => a + Number(i.amount || 0), 0);
    const computed = (paidMap.get(String(b._id)) || 0) + itemPaid;
    const stored = Number(b.totalDisbursed || 0);
    // Prefer the higher figure so we never under-report spent after this feature ships
    if (computed > stored + 1e-9) {
      b.totalDisbursed = computed;
      await b.save();
    }
  }
}

async function listBudgets(req, res) {
  const { role } = req.user;
  const filter = {};
  if (role === "researcher") filter.ownerResearcherId = req.user.id;
  // finance_officer / director can view all
  const budgets = await Budget.find(req.tierWhere(filter))
    .sort({ createdAt: -1 })
    .populate({ path: "grantId", select: "title fundingSource amountAwarded status" })
    .populate({ path: "projectId", select: "title status" });
  try {
    await reconcileDisbursedFromPaid(req, budgets);
  } catch {
    /* best-effort backfill */
  }
  res.json({ budgets: budgets.map(sanitizeBudget) });
}

async function getBudget(req, res) {
  const { id } = req.params;
  const budget = await Budget.findOne(req.tierWhere({ _id: id }));
  if (!budget) throw new AppError("Budget not found", 404);

  const isOwner = String(budget.ownerResearcherId) === String(req.user.id);
  const isStaff = ["finance_officer", "research_director"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ budget: sanitizeBudget(budget) });
}

async function createBudget(req, res) {
  let { grantId, projectId } = req.body || {};
  if (!grantId && !projectId) throw new AppError("grantId or projectId is required", 400);

  // Manual totalAllocated is not accepted — allocation is system-managed from grant/proposal/call.
  if (grantId) {
    const grant = await Grant.findOne(req.tierWhere({ _id: grantId }));
    if (!grant) throw new AppError("Grant not found", 404);
    if (String(grant.researcherId) !== String(req.user.id)) throw new AppError("Forbidden", 403);
    if (projectId && grant.projectId && String(projectId) !== String(grant.projectId)) {
      throw new AppError("projectId must match the grant's linked project", 400);
    }
    if (!projectId && grant.projectId) {
      projectId = grant.projectId;
    }
  }

  if (!projectId) {
    throw new AppError("projectId is required — budgets are auto-allocated on the project", 400);
  }

  const project = await Project.findOne(req.tierWhere({ _id: projectId, researcherId: req.user.id }));
  if (!project) throw new AppError("Research project not found", 404);

  const existing = await Budget.findOne(req.tierWhere({ projectId: project._id }));
  if (existing && Number(existing.totalAllocated || 0) > 0) {
    throw new AppError(
      "This project already has a locked Budget allocated. It cannot be recreated or deleted.",
      400
    );
  }

  const { ensureBudgetForProject } = require("../utils/ensureBudgetForProject");
  const grant = grantId ? await Grant.findOne(req.tierWhere({ _id: grantId })) : null;
  const result = await ensureBudgetForProject(project, { grant });
  if (!result.budget || !(Number(result.budget.totalAllocated || 0) > 0)) {
    throw new AppError(
      "No award amount available to allocate. Budget allocated is created automatically from the funding call / grant.",
      400
    );
  }

  // #region agent log
  try {
    const fs = require("fs");
    const path = require("path");
    fs.appendFileSync(
      path.join(__dirname, "..", "..", "..", "debug-f558f7.log"),
      `${JSON.stringify({
        sessionId: "f558f7",
        hypothesisId: "DEL3",
        location: "budgetController.createBudget",
        message: "system allocate only (no manual totalAllocated)",
        data: {
          projectId: String(project._id),
          created: result.created,
          totalAllocated: result.budget.totalAllocated,
        },
        timestamp: Date.now(),
        runId: "post-fix",
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion

  res.status(result.created ? 201 : 200).json({
    message: result.created
      ? "Budget allocated automatically from award amount"
      : "Budget allocated already exists (locked)",
    budget: sanitizeBudget(result.budget),
  });
}

async function addBudgetItem(req, res) {
  const { id } = req.params;
  const { type, description, amount } = req.body || {};
  if (!type || !description) throw new AppError("type and description are required", 400);
  if (!Object.values(BUDGET_ITEM_TYPES).includes(type)) throw new AppError("Invalid type", 400);
  if (typeof amount !== "number" || amount < 0) throw new AppError("amount must be a non-negative number", 400);

  const budget = await Budget.findOne(req.tierWhere({ _id: id }));
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
      link: budget.projectId ? `/budgets?projectId=${budget.projectId}` : `/budgets?budgetId=${budget._id}`,
    }, req.programTier);
  } catch {
    /* notifications are best-effort */
  }

  res.json({ message: "Item added", budget: sanitizeBudget(budget) });
}

async function financeUpdateItemStatus(req, res) {
  const { id, itemId } = req.params;
  const { status, rejectedReason } = req.body || {};
  if (!Object.values(BUDGET_ITEM_STATUSES).includes(status)) throw new AppError("Invalid status", 400);

  const budget = await Budget.findOne(req.tierWhere({ _id: id }));
  if (!budget) throw new AppError("Budget not found", 404);

  const item = budget.items.id(itemId);
  if (!item) throw new AppError("Budget item not found", 404);

  if (status === BUDGET_ITEM_STATUSES.APPROVED) {
    item.status = status;
    item.approvedBy = req.user.id;
    item.rejectedReason = "";
  } else if (status === BUDGET_ITEM_STATUSES.PAID) {
    if (item.status !== BUDGET_ITEM_STATUSES.APPROVED) throw new AppError("Item must be approved before payment", 400);
    const { deductFromBudget } = require("../utils/budgetDisbursement");
    await deductFromBudget(budget._id, item.amount, { tierWhere: req.tierWhere });
    // reload after deduct (budget doc may be stale)
    const fresh = await Budget.findOne(req.tierWhere({ _id: id }));
    if (!fresh) throw new AppError("Budget not found", 404);
    const freshItem = fresh.items.id(itemId);
    if (!freshItem) throw new AppError("Budget item not found", 404);
    freshItem.status = status;
    freshItem.paidAt = new Date();
    await fresh.save();
    try {
      await notifyUser(fresh.ownerResearcherId, {
        type: "budget",
        title: `Budget item ${status}`,
        body: freshItem.description,
        link: budget.projectId ? `/budgets?projectId=${budget.projectId}` : "/budgets",
        programTier: req.programTier,
      });
    } catch {
      /* notifications are best-effort */
    }
    return res.json({ message: "Item updated", budget: sanitizeBudget(fresh) });
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
      link: budget.projectId ? `/budgets?projectId=${budget.projectId}` : "/budgets",
      programTier: req.programTier,
    });
  } catch {
    /* notifications are best-effort */
  }

  res.json({ message: "Item updated", budget: sanitizeBudget(budget) });
}

module.exports = { listBudgets, getBudget, createBudget, addBudgetItem, financeUpdateItemStatus };


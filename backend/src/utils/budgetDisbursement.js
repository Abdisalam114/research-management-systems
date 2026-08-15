const { Budget } = require("../models/Budget");
const { AppError } = require("./AppError");

function remainingOf(budget) {
  const allocated = Number(budget.totalAllocated || 0);
  const disbursed = Number(budget.totalDisbursed || 0);
  return Math.max(0, allocated - disbursed);
}

/** Sum of in-flight payment/PO/line-item requests that have not been disbursed yet. */
async function pendingCommitments(budgetId) {
  if (!budgetId) return 0;
  const mongoose = require("mongoose");
  const { Payment, PAYMENT_STATUSES } = require("../models/Payment");
  const { PurchaseOrder, PO_STATUSES } = require("../models/PurchaseOrder");
  const { Budget, BUDGET_ITEM_STATUSES } = require("../models/Budget");
  const oid = mongoose.isValidObjectId(budgetId) ? new mongoose.Types.ObjectId(String(budgetId)) : budgetId;

  const [pays, pos, budget] = await Promise.all([
    Payment.aggregate([
      {
        $match: {
          budgetId: oid,
          status: { $in: [PAYMENT_STATUSES.REQUESTED, PAYMENT_STATUSES.DIRECTOR_APPROVED] },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    PurchaseOrder.aggregate([
      {
        $match: {
          budgetId: oid,
          status: {
            $in: [PO_STATUSES.REQUESTED, PO_STATUSES.PROCUREMENT_APPROVED, PO_STATUSES.DIRECTOR_APPROVED],
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    Budget.findById(oid).select("items").lean(),
  ]);

  const itemSum = (budget?.items || [])
    .filter((i) => [BUDGET_ITEM_STATUSES.PENDING, BUDGET_ITEM_STATUSES.APPROVED].includes(i.status))
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return Number(pays[0]?.total || 0) + Number(pos[0]?.total || 0) + itemSum;
}

async function assertAffordableWithCommitments(budget, amount) {
  const committed = await pendingCommitments(budget._id);
  assertAffordable(budget, amount, committed);
}

/**
 * Deduct a paid amount from a budget (increments totalDisbursed).
 * Fails if remaining balance is insufficient.
 */
async function deductFromBudget(budgetId, amount, { tierWhere } = {}) {
  const amt = Number(amount || 0);
  if (!budgetId) throw new AppError("Budget is required for disbursement", 400);
  if (!Number.isFinite(amt) || amt < 0) throw new AppError("Invalid disbursement amount", 400);
  if (amt === 0) {
    const budget = await Budget.findOne(tierWhere ? tierWhere({ _id: budgetId }) : { _id: budgetId });
    if (!budget) throw new AppError("Budget not found", 404);
    return budget;
  }

  const filter = tierWhere ? tierWhere({ _id: budgetId }) : { _id: budgetId };
  const updated = await Budget.findOneAndUpdate(
    {
      ...filter,
      $expr: {
        $gte: [
          {
            $subtract: [
              { $ifNull: ["$totalAllocated", 0] },
              { $ifNull: ["$totalDisbursed", 0] },
            ],
          },
          amt,
        ],
      },
    },
    { $inc: { totalDisbursed: amt } },
    { new: true }
  );
  if (updated) return updated;

  const budget = await Budget.findOne(filter);
  if (!budget) throw new AppError("Budget not found", 404);
  const remaining = remainingOf(budget);
  throw new AppError(
    `Insufficient budget remaining. Remaining: ${remaining.toLocaleString()}, requested: ${amt.toLocaleString()}`,
    400
  );
}

function assertAffordable(budget, amount, committed = 0) {
  const amt = Number(amount || 0);
  const remaining = remainingOf(budget) - Number(committed || 0);
  if (amt > remaining + 1e-9) {
    throw new AppError(
      `Amount exceeds available budget (${Math.max(0, remaining).toLocaleString()} left of ${Number(budget.totalAllocated || 0).toLocaleString()} after pending requests)`,
      400
    );
  }
}

module.exports = {
  deductFromBudget,
  remainingOf,
  pendingCommitments,
  assertAffordable,
  assertAffordableWithCommitments,
};

const { Budget } = require("../models/Budget");
const { AppError } = require("./AppError");

function remainingOf(budget) {
  const allocated = Number(budget.totalAllocated || 0);
  const disbursed = Number(budget.totalDisbursed || 0);
  return Math.max(0, allocated - disbursed);
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
  const budget = await Budget.findOne(filter);
  if (!budget) throw new AppError("Budget not found", 404);

  const remaining = remainingOf(budget);
  if (amt > remaining + 1e-9) {
    throw new AppError(
      `Insufficient budget remaining. Remaining: ${remaining.toLocaleString()}, requested: ${amt.toLocaleString()}`,
      400
    );
  }

  budget.totalDisbursed = Number(budget.totalDisbursed || 0) + amt;
  await budget.save();
  return budget;
}

function assertAffordable(budget, amount) {
  const amt = Number(amount || 0);
  const remaining = remainingOf(budget);
  if (amt > remaining + 1e-9) {
    throw new AppError(
      `Amount exceeds remaining budget (${remaining.toLocaleString()} left of ${Number(budget.totalAllocated || 0).toLocaleString()})`,
      400
    );
  }
}

module.exports = { deductFromBudget, remainingOf, assertAffordable };

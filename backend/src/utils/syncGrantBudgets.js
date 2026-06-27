const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { ensureBudgetForGrant } = require("./ensureBudgetForGrant");

/** Backfill budgets for awarded grants that have no budget row yet. */
async function syncGrantBudgets(filter = {}) {
  const grants = await Grant.find({
    ...filter,
    status: { $in: [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.APPROVED] },
    amountAwarded: { $gt: 0 },
  });

  let created = 0;
  let updated = 0;
  for (const grant of grants) {
    const result = await ensureBudgetForGrant(grant);
    if (result.created) created += 1;
    if (result.updated) updated += 1;
  }

  return { scanned: grants.length, created, updated };
}

module.exports = { syncGrantBudgets };

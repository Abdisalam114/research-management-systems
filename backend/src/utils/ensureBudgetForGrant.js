const { Budget } = require("../models/Budget");
const { Grant, GRANT_STATUSES } = require("../models/Grant");

const AWARDED_STATUSES = [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.APPROVED];

/**
 * Create or refresh a budget row when a grant is awarded.
 * One budget per grant; totalAllocated tracks amountAwarded.
 */
async function ensureBudgetForGrant(grant) {
  if (!grant?._id) return { budget: null, created: false, updated: false };

  const awarded = Number(grant.amountAwarded || 0);
  if (awarded <= 0 || !AWARDED_STATUSES.includes(grant.status)) {
    return { budget: null, created: false, updated: false };
  }

  const existing = await Budget.findOne({ grantId: grant._id });
  if (existing) {
    let changed = false;
    if (Number(existing.totalAllocated || 0) !== awarded) {
      existing.totalAllocated = awarded;
      changed = true;
    }
    if (grant.projectId && String(existing.projectId || "") !== String(grant.projectId)) {
      existing.projectId = grant.projectId;
      changed = true;
    }
    if (grant.currency && existing.currency !== grant.currency) {
      existing.currency = grant.currency;
      changed = true;
    }
    if (changed) await existing.save();
    return { budget: existing, created: false, updated: changed };
  }

  const budget = await Budget.create({
    grantId: grant._id,
    projectId: grant.projectId || null,
    ownerResearcherId: grant.researcherId,
    programTier: grant.programTier,
    totalAllocated: awarded,
    currency: grant.currency || "USD",
    items: [],
  });

  return { budget, created: true, updated: false };
}

module.exports = { ensureBudgetForGrant };

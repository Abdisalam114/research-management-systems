const { Budget } = require("../models/Budget");
const { Grant, GRANT_STATUSES } = require("../models/Grant");

const AWARDED_STATUSES = [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.APPROVED];

/**
 * Create or refresh a budget when finance authorizes a grant award.
 * Sets totalAllocated only — does NOT mark funds as paid (totalDisbursed stays 0).
 * Actual payments happen later via budget items / payments / POs.
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
      if (!(Number(existing.totalAllocated || 0) > 0 && awarded < Number(existing.totalAllocated || 0))) {
        existing.totalAllocated = awarded;
        changed = true;
      }
    }
    if (grant.projectId && String(existing.projectId || "") !== String(grant.projectId)) {
      existing.projectId = grant.projectId;
      changed = true;
    }
    if (grant.currency && existing.currency !== grant.currency) {
      existing.currency = grant.currency;
      changed = true;
    }
    // Never treat finance authorization as a disbursement
    if (existing.totalDisbursed == null) {
      existing.totalDisbursed = 0;
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
    totalDisbursed: 0,
    currency: grant.currency || "USD",
    items: [],
  });

  return { budget, created: true, updated: false };
}

module.exports = { ensureBudgetForGrant };

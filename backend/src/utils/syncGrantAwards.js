const { Grant, GRANT_STATUSES } = require("../models/Grant");

const AWARDED_STATUSES = [GRANT_STATUSES.ACTIVE, GRANT_STATUSES.APPROVED];

/**
 * Grants marked active/approved should have amountAwarded set.
 * Repairs legacy rows where status was updated without awarded amount.
 */
async function syncGrantAwards(filter = {}) {
  const grants = await Grant.find({
    ...filter,
    status: { $in: AWARDED_STATUSES },
    $or: [{ amountAwarded: { $exists: false } }, { amountAwarded: 0 }],
  });

  let updated = 0;
  for (const grant of grants) {
    const requested = Number(grant.amountRequested || 0);
    if (requested <= 0) continue;
    grant.amountAwarded = requested;
    if (grant.status === GRANT_STATUSES.APPROVED) {
      grant.status = GRANT_STATUSES.ACTIVE;
    }
    if (!grant.decidedAt) grant.decidedAt = grant.updatedAt || new Date();
    await grant.save();
    updated += 1;
  }

  return { scanned: grants.length, updated };
}

module.exports = { syncGrantAwards };

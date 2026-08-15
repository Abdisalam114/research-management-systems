const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Budget } = require("../models/Budget");

const STATUS_RANK = Object.freeze({
  [GRANT_STATUSES.ACTIVE]: 70,
  [GRANT_STATUSES.APPROVED]: 60,
  [GRANT_STATUSES.PENDING_FINANCE]: 50,
  [GRANT_STATUSES.SUBMITTED]: 40,
  [GRANT_STATUSES.CLOSED]: 30,
  [GRANT_STATUSES.DRAFT]: 20,
  [GRANT_STATUSES.REJECTED]: 10,
});

function idOf(value) {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
}

function applicationKey(grant) {
  const researcherId = idOf(grant.researcherId);
  const callId = idOf(grant.callId);
  const proposalId = idOf(grant.proposalId);
  if (researcherId && callId && proposalId) return `p:${researcherId}|${callId}|${proposalId}`;
  if (researcherId && callId) return `c:${researcherId}|${callId}`;
  return `id:${idOf(grant._id)}`;
}

function pickPreferredGrant(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ra = STATUS_RANK[a.status] || 0;
  const rb = STATUS_RANK[b.status] || 0;
  if (ra !== rb) return ra >= rb ? a : b;
  const aa = Number(a.amountAwarded || 0);
  const ab = Number(b.amountAwarded || 0);
  if (aa !== ab) return aa >= ab ? a : b;
  const ca = new Date(a.createdAt || 0).getTime();
  const cb = new Date(b.createdAt || 0).getTime();
  if (ca !== cb) return ca <= cb ? a : b;
  return idOf(a._id) <= idOf(b._id) ? a : b;
}

function groupKeepers(grants) {
  const byKey = new Map();
  for (const grant of grants) {
    const key = applicationKey(grant);
    byKey.set(key, pickPreferredGrant(byKey.get(key), grant));
  }
  const entries = [...byKey.entries()];
  for (const [key, grant] of entries) {
    if (!key.startsWith("c:")) continue;
    const prefix = key.slice(2);
    const withProposal = entries.find(([otherKey]) => otherKey.startsWith(`p:${prefix}|`));
    if (!withProposal) continue;
    byKey.set(withProposal[0], pickPreferredGrant(withProposal[1], grant));
    byKey.delete(key);
  }
  return byKey;
}

function dedupeGrantList(grants = []) {
  const keepers = groupKeepers(grants);
  const keepIds = new Set([...keepers.values()].map((g) => idOf(g._id || g.id)));
  return grants.filter((g) => keepIds.has(idOf(g._id || g.id)));
}

async function rehomeExtraGrant(extra, keeper) {
  const extraId = extra._id;
  const keeperId = keeper._id;
  const extraBudget = await Budget.findOne({ grantId: extraId });
  if (!extraBudget) return;
  const keeperBudget = await Budget.findOne({ grantId: keeperId });
  if (!keeperBudget) {
    extraBudget.grantId = keeperId;
    await extraBudget.save();
    return;
  }
  extraBudget.grantId = null;
  await extraBudget.save();
}

/**
 * Keep one grant per researcher + funding call + proposal.
 * Extra drafts (double-submit / race) are deleted; budgets are rehomed when needed.
 */
async function collapseDuplicateFundingCallGrants() {
  const grants = await Grant.find({
    callId: { $ne: null },
    status: { $ne: GRANT_STATUSES.REJECTED },
  }).select("_id researcherId callId proposalId status amountAwarded createdAt");

  const keepers = groupKeepers(grants);
  const keepIds = new Set([...keepers.values()].map((g) => idOf(g._id)));
  const extras = grants.filter((g) => !keepIds.has(idOf(g._id)));
  if (!extras.length) {
    return { removed: 0 };
  }

  let removed = 0;
  for (const extra of extras) {
    const key = applicationKey(extra);
    let keeper = keepers.get(key);
    if (!keeper) {
      const researcherId = idOf(extra.researcherId);
      const callId = idOf(extra.callId);
      keeper = [...keepers.values()].find(
        (g) => idOf(g.researcherId) === researcherId && idOf(g.callId) === callId
      );
    }
    if (keeper && idOf(keeper._id) !== idOf(extra._id)) {
      await rehomeExtraGrant(extra, keeper);
    }
    await Grant.deleteOne({ _id: extra._id });
    removed += 1;
  }
  return { removed };
}

module.exports = {
  collapseDuplicateFundingCallGrants,
  dedupeGrantList,
  applicationKey,
  pickPreferredGrant,
};

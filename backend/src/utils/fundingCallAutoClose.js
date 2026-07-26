const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { recordAudit } = require("./audit");

/**
 * Persist-close any OPEN funding calls whose deadline has passed.
 * Safe to call on list/get/apply — idempotent.
 */
async function closeExpiredOpenCalls({ actorId = null, actorRole = "system", programTier = null } = {}) {
  const now = new Date();
  const expired = await FundingCall.find({
    status: CALL_STATUSES.OPEN,
    deadline: { $ne: null, $lt: now },
  }).select("_id title deadline programTier");

  if (!expired.length) {
    return { closedCount: 0, ids: [] };
  }

  const ids = expired.map((c) => c._id);
  await FundingCall.updateMany(
    { _id: { $in: ids }, status: CALL_STATUSES.OPEN },
    { $set: { status: CALL_STATUSES.CLOSED, closedAt: now } }
  );

  for (const call of expired) {
    try {
      await recordAudit({
        entityType: "funding_call",
        entityId: call._id,
        action: "auto_closed_deadline",
        label: "Funding call auto-closed (deadline)",
        detail: call.title,
        actorId: actorId || undefined,
        actorRole: actorRole || "system",
        programTier: programTier || call.programTier,
      });
    } catch {
      /* best-effort */
    }
  }

  return { closedCount: ids.length, ids: ids.map(String) };
}

/**
 * Close an open funding call after a grant application is accepted.
 */
async function closeCallAfterGrantAccepted(callId, { actorId, actorRole, programTier, grantTitle } = {}) {
  const resolvedId =
    callId && typeof callId === "object" && callId._id != null ? callId._id : callId;
  if (!resolvedId) {
    return null;
  }

  const call = await FundingCall.findById(resolvedId);
  if (!call) {
    return null;
  }
  if (call.status !== CALL_STATUSES.OPEN) {
    return call;
  }

  call.status = CALL_STATUSES.CLOSED;
  call.closedAt = new Date();
  await call.save();

  try {
    await recordAudit({
      entityType: "funding_call",
      entityId: call._id,
      action: "auto_closed_grant_accepted",
      label: "Funding call auto-closed (grant accepted)",
      detail: grantTitle ? `${call.title} ← ${grantTitle}` : call.title,
      actorId,
      actorRole,
      programTier: programTier || call.programTier,
    });
  } catch {
    /* best-effort */
  }

  return call;
}

module.exports = {
  closeExpiredOpenCalls,
  closeCallAfterGrantAccepted,
};

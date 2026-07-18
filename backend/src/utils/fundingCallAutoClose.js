const fs = require("fs");
const path = require("path");
const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { recordAudit } = require("./audit");

const DEBUG_LOG = path.join(__dirname, "../../../debug-f558f7.log");

function debugLog(hypothesisId, location, message, data) {
  // #region agent log
  try {
    fs.appendFileSync(
      DEBUG_LOG,
      `${JSON.stringify({
        sessionId: "f558f7",
        runId: "call-autoclose",
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      })}\n`
    );
  } catch {
    /* ignore */
  }
  // #endregion
}

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
    debugLog("H1", "fundingCallAutoClose.js:closeExpired", "no expired open calls", {
      now: now.toISOString(),
    });
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

  debugLog("H1", "fundingCallAutoClose.js:closeExpired", "auto-closed expired calls", {
    closedCount: ids.length,
    ids: ids.map(String),
    titles: expired.map((c) => c.title),
  });

  return { closedCount: ids.length, ids: ids.map(String) };
}

/**
 * Close an open funding call after a grant application is accepted.
 */
async function closeCallAfterGrantAccepted(callId, { actorId, actorRole, programTier, grantTitle } = {}) {
  if (!callId) {
    debugLog("H2", "fundingCallAutoClose.js:afterAccept", "no callId on grant", {});
    return null;
  }

  const call = await FundingCall.findById(callId);
  if (!call) {
    debugLog("H2", "fundingCallAutoClose.js:afterAccept", "call not found", { callId: String(callId) });
    return null;
  }
  if (call.status !== CALL_STATUSES.OPEN) {
    debugLog("H2", "fundingCallAutoClose.js:afterAccept", "call already not open", {
      callId: String(callId),
      status: call.status,
    });
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

  debugLog("H2", "fundingCallAutoClose.js:afterAccept", "auto-closed call after grant accepted", {
    callId: String(call._id),
    title: call.title,
    grantTitle: grantTitle || null,
  });

  return call;
}

module.exports = {
  closeExpiredOpenCalls,
  closeCallAfterGrantAccepted,
};

const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { AuditEvent } = require("../models/AuditEvent");
const { recordAudit } = require("./audit");
const { startOfTodayUtc } = require("./dateConstraints");

const ACCEPTED_GRANT_STATUSES = [
  GRANT_STATUSES.PENDING_FINANCE,
  GRANT_STATUSES.ACTIVE,
  GRANT_STATUSES.APPROVED,
];

async function findAcceptedAwardCallIds() {
  const [grants, proposals] = await Promise.all([
    Grant.find({
      callId: { $ne: null },
      status: { $in: ACCEPTED_GRANT_STATUSES },
    })
      .select("callId")
      .lean(),
    Proposal.find({
      fundingCallId: { $ne: null },
      status: PROPOSAL_STATUSES.APPROVED,
    })
      .select("fundingCallId")
      .lean(),
  ]);
  return new Set([
    ...grants.map((g) => String(g.callId)).filter(Boolean),
    ...proposals.map((p) => String(p.fundingCallId)).filter(Boolean),
  ]);
}

/**
 * Persist-close any OPEN funding calls whose deadline day has ended.
 * A deadline of "today" stays OPEN until tomorrow (inclusive calendar day).
 * Also reopens calls that were auto-closed too early on the deadline day —
 * except calls that already have an accepted researcher.
 */
async function closeExpiredOpenCalls({ actorId = null, actorRole = "system", programTier = null } = {}) {
  const cutoff = startOfTodayUtc();
  const now = new Date();

  await closeCallsWithAcceptedAwards({ actorId, actorRole, programTier });
  await reopenPrematureDeadlineCloses({ actorId, actorRole, programTier, cutoff });

  const expired = await FundingCall.find({
    status: CALL_STATUSES.OPEN,
    deadline: { $ne: null, $lt: cutoff },
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

async function closeCallsWithAcceptedAwards({ actorId, actorRole, programTier } = {}) {
  const awardedIds = [...(await findAcceptedAwardCallIds())];
  if (!awardedIds.length) return;

  const stillOpen = await FundingCall.find({
    _id: { $in: awardedIds },
    status: CALL_STATUSES.OPEN,
  }).select("_id title programTier");
  if (!stillOpen.length) return;

  for (const call of stillOpen) {
    await closeCallAfterGrantAccepted(call._id, {
      actorId,
      actorRole,
      programTier: programTier || call.programTier,
      grantTitle: call.title,
    });
  }
}

async function reopenPrematureDeadlineCloses({ actorId, actorRole, programTier, cutoff }) {
  const candidates = await FundingCall.find({
    status: CALL_STATUSES.CLOSED,
    deadline: { $ne: null, $gte: cutoff },
  }).select("_id title programTier");
  if (!candidates.length) return;

  const awardedIds = await findAcceptedAwardCallIds();
  const ids = candidates.map((c) => c._id);
  let events = [];
  try {
    events = await AuditEvent.find({
      entityType: "funding_call",
      entityId: { $in: ids },
      action: { $in: ["auto_closed_deadline", "auto_closed_grant_accepted", "closed"] },
    })
      .sort({ createdAt: -1 })
      .select("entityId action")
      .lean();
  } catch {
    return;
  }

  const lastClose = new Map();
  for (const e of events) {
    const id = String(e.entityId);
    if (!lastClose.has(id)) lastClose.set(id, e.action);
  }

  const reopen = candidates.filter((c) => {
    const id = String(c._id);
    if (awardedIds.has(id)) return false;
    return lastClose.get(id) === "auto_closed_deadline";
  });
  if (!reopen.length) return;

  const reopenIds = reopen.map((c) => c._id);
  await FundingCall.updateMany(
    { _id: { $in: reopenIds }, status: CALL_STATUSES.CLOSED },
    { $set: { status: CALL_STATUSES.OPEN, closedAt: null } }
  );

  for (const call of reopen) {
    try {
      await recordAudit({
        entityType: "funding_call",
        entityId: call._id,
        action: "reopened_deadline_day",
        label: "Funding call reopened (deadline day still open)",
        detail: call.title,
        actorId: actorId || undefined,
        actorRole: actorRole || "system",
        programTier: programTier || call.programTier,
      });
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Close a funding call after a researcher is accepted.
 * Awarded calls are never reopened, even if the deadline day has not ended.
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
      label: "Funding call auto-closed (researcher accepted)",
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
  findAcceptedAwardCallIds,
};

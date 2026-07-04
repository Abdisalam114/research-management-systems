const { AuditEvent } = require("../models/AuditEvent");
const { AppError } = require("../utils/AppError");
const { sanitizeAuditEvent } = require("../utils/audit");

async function getEntityAudit(req, res) {
  const { entityType, entityId } = req.params;
  const events = await AuditEvent.find(req.tierWhere({ entityType, entityId }))
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("actorId", "fullName email role");
  res.json({
    events: events.map((e) => ({
      ...sanitizeAuditEvent(e),
      actorName: e.actorId?.fullName || null,
    })),
  });
}

async function listRecentAudit(req, res) {
  const limit = Math.min(Number(req.query?.limit) || 50, 200);
  const filter = {};
  if (req.query?.entityType) filter.entityType = req.query.entityType;

  const events = await AuditEvent.find(req.tierWhere(filter))
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actorId", "fullName email role");

  res.json({
    events: events.map((e) => ({
      ...sanitizeAuditEvent(e),
      actorName: e.actorId?.fullName || null,
    })),
  });
}

module.exports = { getEntityAudit, listRecentAudit };

const { AuditEvent } = require("../models/AuditEvent");
const { AppError } = require("../utils/AppError");
const { sanitizeAuditEvent } = require("../utils/audit");

async function getEntityAudit(req, res) {
  const { entityType, entityId } = req.params;
  // Researchers: show full trail for the entity (pages already gate entity access).
  // Staff: portal-scoped.
  const filter =
    req.user?.role === "researcher"
      ? { entityType, entityId }
      : req.tierWhere({ entityType, entityId });
  const events = await AuditEvent.find(filter)
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
  if (req.user?.role === "researcher") filter.actorId = req.user.id;

  const events = await AuditEvent.find(
    req.user?.role === "researcher" ? filter : req.tierWhere(filter)
  )
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

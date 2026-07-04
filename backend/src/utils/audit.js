const { AuditEvent } = require("../models/AuditEvent");

async function recordAudit({
  entityType,
  entityId,
  action,
  label,
  detail = "",
  actorId = null,
  actorRole = "",
  metadata = null,
  programTier = null,
}) {
  try {
    await AuditEvent.create({
      entityType,
      entityId,
      action,
      label,
      detail,
      actorId,
      actorRole,
      metadata,
      ...(programTier ? { programTier } : {}),
    });
  } catch {
    /* audit is best-effort */
  }
}

function sanitizeAuditEvent(e) {
  return {
    id: e._id,
    entityType: e.entityType,
    entityId: e.entityId,
    action: e.action,
    label: e.label,
    detail: e.detail,
    actorId: e.actorId,
    actorRole: e.actorRole,
    metadata: e.metadata,
    at: e.createdAt,
    programTier: e.programTier,
  };
}

module.exports = { recordAudit, sanitizeAuditEvent };

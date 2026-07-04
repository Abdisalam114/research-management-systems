const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const auditEventSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, index: true },
    label: { type: String, required: true },
    detail: { type: String, default: "" },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
    ...programTierField,
  },
  { timestamps: true }
);

auditEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

const AuditEvent = mongoose.model("AuditEvent", auditEventSchema);

module.exports = { AuditEvent };

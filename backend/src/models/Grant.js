const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const GRANT_STATUSES = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  ACTIVE: "active",
  CLOSED: "closed",
});

const grantSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    fundingSource: { type: String, required: true, trim: true },
    donorRef: { type: String, default: "", trim: true },
    currency: { type: String, default: "USD", trim: true, uppercase: true },
    amountRequested: { type: Number, min: 0, required: true },
    amountAwarded: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: Object.values(GRANT_STATUSES), default: GRANT_STATUSES.DRAFT, index: true },
    complianceNotes: { type: String, default: "" },

    researcherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },

    submittedAt: { type: Date, default: null },
    decidedAt: { type: Date, default: null },
    ...programTierField,
  },
  { timestamps: true }
);

const Grant = mongoose.model("Grant", grantSchema);

module.exports = { Grant, GRANT_STATUSES };


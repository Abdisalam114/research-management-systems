const mongoose = require("mongoose");

const POLICY_TYPES = Object.freeze({
  POLICY: "policy",
  THEME: "theme",
  PRIORITY: "priority",
  PROGRAM: "program",
});

const POLICY_STATUSES = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
});

const researchPolicySchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(POLICY_TYPES), required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: Object.values(POLICY_STATUSES),
      default: POLICY_STATUSES.DRAFT,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const ResearchPolicy = mongoose.model("ResearchPolicy", researchPolicySchema);

module.exports = { ResearchPolicy, POLICY_TYPES, POLICY_STATUSES };

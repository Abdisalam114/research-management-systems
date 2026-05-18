const mongoose = require("mongoose");

const PROPOSAL_STATUSES = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  REVISION_REQUESTED: "revision_requested",
});

const ETHICS_STATUSES = Object.freeze({
  NOT_REQUIRED: "not_required",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  REVISION_REQUESTED: "revision_requested",
});

const proposalSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    abstract: { type: String, required: true },
    department: { type: String, required: true, trim: true },
    researchArea: { type: String, required: true, trim: true },
    document: { type: String, default: null },
    version: { type: Number, default: 1, min: 1 },
    versionHistory: [
      {
        version: { type: Number, required: true },
        document: { type: String, default: null },
        note: { type: String, default: "" },
        savedAt: { type: Date, default: Date.now },
      },
    ],
    researcherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: Object.values(PROPOSAL_STATUSES),
      default: PROPOSAL_STATUSES.DRAFT,
      index: true,
    },
    requiresEthics: { type: Boolean, default: true },
    ethicsStatus: {
      type: String,
      enum: Object.values(ETHICS_STATUSES),
      default: ETHICS_STATUSES.PENDING,
      index: true,
    },
    ethicsComments: [
      {
        role: { type: String, required: true },
        comment: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    assignedReviewers: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        assignedAt: { type: Date, default: Date.now },
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      },
    ],
    reviewerComments: [
      {
        role: { type: String, required: true },
        comment: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Proposal = mongoose.model("Proposal", proposalSchema);

module.exports = { Proposal, PROPOSAL_STATUSES, ETHICS_STATUSES };

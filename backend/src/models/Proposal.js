const mongoose = require("mongoose");

const PROPOSAL_STATUSES = Object.freeze({
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
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
    document: { type: String, default: null }, // stored file path
    version: { type: Number, default: 1, min: 1 },
    researcherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: Object.values(PROPOSAL_STATUSES),
      default: PROPOSAL_STATUSES.DRAFT,
      index: true,
    },
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

module.exports = { Proposal, PROPOSAL_STATUSES };


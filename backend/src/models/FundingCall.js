const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const CALL_STATUSES = Object.freeze({
  DRAFT: "draft",
  OPEN: "open",
  CLOSED: "closed",
});

const ELIGIBILITY_TIERS = Object.freeze(["ug", "pg", "pgd", "all"]);

const fundingCallSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    fundingSource: { type: String, required: true, trim: true },
    donorRef: { type: String, default: "", trim: true },
    amountCap: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "USD", trim: true, uppercase: true },
    deadline: { type: Date, default: null },
    eligibilityTier: { type: String, enum: ELIGIBILITY_TIERS, default: "all" },
    requiredDocuments: { type: String, default: "" },
    status: { type: String, enum: Object.values(CALL_STATUSES), default: CALL_STATUSES.DRAFT, index: true },
    publishedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ...programTierField,
  },
  { timestamps: true }
);

const FundingCall = mongoose.model("FundingCall", fundingCallSchema);

module.exports = { FundingCall, CALL_STATUSES, ELIGIBILITY_TIERS };

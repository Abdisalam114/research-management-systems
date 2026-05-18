const mongoose = require("mongoose");

const BUDGET_ITEM_TYPES = Object.freeze({
  EXPENSE: "expense",
  PROCUREMENT: "procurement",
});

const BUDGET_ITEM_STATUSES = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  PAID: "paid",
  REJECTED: "rejected",
});

const budgetItemSchema = new mongoose.Schema(
  {
    type: { type: String, enum: Object.values(BUDGET_ITEM_TYPES), required: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, min: 0, required: true },
    status: { type: String, enum: Object.values(BUDGET_ITEM_STATUSES), default: BUDGET_ITEM_STATUSES.PENDING, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
    rejectedReason: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const budgetSchema = new mongoose.Schema(
  {
    grantId: { type: mongoose.Schema.Types.ObjectId, ref: "Grant", default: null, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    ownerResearcherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    totalAllocated: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "USD", trim: true, uppercase: true },
    financeNotes: { type: String, default: "" },

    items: [budgetItemSchema],
  },
  { timestamps: true }
);

budgetSchema.index({ grantId: 1, projectId: 1 });

const Budget = mongoose.model("Budget", budgetSchema);

module.exports = { Budget, BUDGET_ITEM_TYPES, BUDGET_ITEM_STATUSES };


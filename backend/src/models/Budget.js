const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

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
    /** Sum of amounts marked paid (payments, POs, budget line items). Remaining = allocated − disbursed. */
    totalDisbursed: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: "USD", trim: true, uppercase: true },
    financeNotes: { type: String, default: "" },

    items: [budgetItemSchema],
    ...programTierField,
  },
  { timestamps: true }
);

budgetSchema.index({ grantId: 1, projectId: 1 });

/** System-wide: allocated budgets must never be deleted. */
async function assertNoAllocatedBudgetDelete(filter, model) {
  const docs = await model.find(filter).select("_id totalAllocated").lean();
  const blocked = docs.filter((d) => Number(d.totalAllocated || 0) > 0);
  if (blocked.length) {
    const err = new Error(
      "Budget allocated cannot be deleted. Allocated project/grant budgets are protected system-wide."
    );
    err.statusCode = 400;
    err.code = "BUDGET_ALLOCATED_LOCKED";
    throw err;
  }
}

budgetSchema.pre("deleteOne", { document: false, query: true }, async function budgetDeleteOneGuard() {
  await assertNoAllocatedBudgetDelete(this.getFilter(), this.model);
});

budgetSchema.pre("findOneAndDelete", async function budgetFindOneAndDeleteGuard() {
  await assertNoAllocatedBudgetDelete(this.getFilter(), this.model);
});

budgetSchema.pre("deleteMany", async function budgetDeleteManyGuard() {
  await assertNoAllocatedBudgetDelete(this.getFilter(), this.model);
});

budgetSchema.pre("save", async function budgetAllocatedLock() {
  if (this.isNew) return;
  if (!this.isModified("totalAllocated")) return;
  const prior = await this.constructor.findById(this._id).select("totalAllocated").lean();
  const prev = Number(prior?.totalAllocated || 0);
  const nextVal = Number(this.totalAllocated || 0);
  // Never clear or reduce an existing allocation (system-managed)
  if (prev > 0 && nextVal < prev) {
    const err = new Error("Budget allocated cannot be reduced or cleared once set.");
    err.statusCode = 400;
    err.code = "BUDGET_ALLOCATED_LOCKED";
    throw err;
  }
});

const Budget = mongoose.model("Budget", budgetSchema);

module.exports = { Budget, BUDGET_ITEM_TYPES, BUDGET_ITEM_STATUSES };


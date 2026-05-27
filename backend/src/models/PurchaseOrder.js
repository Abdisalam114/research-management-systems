const mongoose = require("mongoose");

const PO_STATUSES = Object.freeze({
  REQUESTED: "requested",
  DIRECTOR_APPROVED: "director_approved",
  PAID: "paid",
  REJECTED: "rejected",
});

const PO_PAYMENT_METHODS = Object.freeze({
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  MOBILE_MONEY: "mobile_money",
  CHECK: "check",
  OTHER: "other",
});

const poItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, min: 1, default: 1 },
    unitPrice: { type: Number, min: 0, required: true },
  },
  { _id: true }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, default: "", trim: true, index: true },
    budgetId: { type: mongoose.Schema.Types.ObjectId, ref: "Budget", required: true, index: true },
    vendorName: { type: String, required: true, trim: true },
    vendorContact: { type: String, default: "", trim: true },
    currency: { type: String, default: "USD", trim: true, uppercase: true },
    items: [poItemSchema],
    totalAmount: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(PO_STATUSES),
      default: PO_STATUSES.REQUESTED,
      index: true,
    },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    grantId: { type: mongoose.Schema.Types.ObjectId, ref: "Grant", default: null, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    directorApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    directorApprovedAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
    paymentMethod: {
      type: String,
      enum: [...Object.values(PO_PAYMENT_METHODS), ""],
      default: "",
    },
    paymentMethodDetails: { type: String, default: "" },
    rejectedReason: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

purchaseOrderSchema.pre("save", function computeTotal() {
  if (Array.isArray(this.items)) {
    this.totalAmount = this.items.reduce(
      (acc, it) => acc + Number(it.unitPrice || 0) * Number(it.quantity || 0),
      0
    );
  }
});

const PurchaseOrder = mongoose.model("PurchaseOrder", purchaseOrderSchema);

module.exports = { PurchaseOrder, PO_STATUSES, PO_PAYMENT_METHODS };

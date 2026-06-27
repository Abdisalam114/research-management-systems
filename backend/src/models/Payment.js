const mongoose = require("mongoose");
const { programTierField } = require("../constants/programTierField");

const PAYMENT_CATEGORIES = Object.freeze({
  RESEARCH_ASSISTANT: "research_assistant",
  EQUIPMENT: "equipment",
  TRAVEL: "travel",
  PUBLICATION_FEE: "publication_fee",
  OTHER: "other",
});

const PAYMENT_STATUSES = Object.freeze({
  REQUESTED: "requested",
  DIRECTOR_APPROVED: "director_approved",
  PAID: "paid",
  REJECTED: "rejected",
});

const PAYMENT_METHODS = Object.freeze({
  CASH: "cash",
  BANK_TRANSFER: "bank_transfer",
  MOBILE_MONEY: "mobile_money",
  CHECK: "check",
  OTHER: "other",
});

const paymentSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: Object.values(PAYMENT_CATEGORIES),
      required: true,
      index: true,
    },
    budgetId: { type: mongoose.Schema.Types.ObjectId, ref: "Budget", required: true, index: true },
    payee: { type: String, required: true, trim: true },
    purpose: { type: String, required: true, trim: true },
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, default: "USD", trim: true, uppercase: true },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUSES),
      default: PAYMENT_STATUSES.REQUESTED,
      index: true,
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    directorApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    directorApprovedAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
    paymentMethod: {
      type: String,
      enum: [...Object.values(PAYMENT_METHODS), ""],
      default: "",
    },
    paymentMethodDetails: { type: String, default: "" },
    rejectedReason: { type: String, default: "" },
    referenceNumber: { type: String, default: "", trim: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    grantId: { type: mongoose.Schema.Types.ObjectId, ref: "Grant", default: null, index: true },
    notes: { type: String, default: "" },
    ...programTierField,
  },
  { timestamps: true }
);

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = { Payment, PAYMENT_CATEGORIES, PAYMENT_STATUSES, PAYMENT_METHODS };

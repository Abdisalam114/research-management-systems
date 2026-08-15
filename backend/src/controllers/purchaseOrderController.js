const { PurchaseOrder, PO_STATUSES, PO_PAYMENT_METHODS } = require("../models/PurchaseOrder");
const { Budget } = require("../models/Budget");
const { AppError } = require("../utils/AppError");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");
const { deductFromBudget, assertAffordableWithCommitments, remainingOf } = require("../utils/budgetDisbursement");

function sanitizePO(po) {
  return {
    id: po._id,
    poNumber: po.poNumber,
    budgetId: po.budgetId,
    vendorName: po.vendorName,
    vendorContact: po.vendorContact,
    currency: po.currency,
    items: po.items,
    totalAmount: po.totalAmount,
    status: po.status,
    projectId: po.projectId,
    grantId: po.grantId,
    requestedBy: po.requestedBy,
    directorApprovedBy: po.directorApprovedBy,
    directorApprovedAt: po.directorApprovedAt,
    paidBy: po.paidBy,
    paidAt: po.paidAt,
    paymentMethod: po.paymentMethod,
    paymentMethodDetails: po.paymentMethodDetails,
    rejectedReason: po.rejectedReason,
    notes: po.notes,
    createdAt: po.createdAt,
    updatedAt: po.updatedAt,
  };
}

async function listPurchaseOrders(req, res) {
  const { role } = req.user;
  const filter =
    role === "researcher"
      ? req.ownedWhere({}, { ownerField: "requestedBy" })
      : req.tierWhere({});
  const pos = await PurchaseOrder.find(filter).sort({ createdAt: -1 });
  res.json({ purchaseOrders: pos.map(sanitizePO) });
}

async function procurementDecision(req, res) {
  const { id } = req.params;
  const { decision, rejectedReason } = req.body || {};
if (!["approve", "reject"].includes(decision)) {
    throw new AppError("decision must be 'approve' or 'reject'", 400);
  }
  const po = await PurchaseOrder.findOne(req.tierWhere({ _id: id }));
  if (!po) throw new AppError("Purchase order not found", 404);
  if (po.status !== PO_STATUSES.REQUESTED) throw new AppError("PO is not awaiting finance review", 400);

  if (decision === "approve") {
    po.status = PO_STATUSES.PROCUREMENT_APPROVED;
    po.procurementApprovedBy = req.user.id;
    po.procurementApprovedAt = new Date();
    po.rejectedReason = "";
    try {
      await notifyUsersByRole("research_director", {
        type: "budget",
        title: "PO finance-reviewed — director approval needed",
        body: `${po.vendorName} — ${po.currency} ${po.totalAmount}`,
        link: po.projectId ? `/budgets?projectId=${po.projectId}` : "/budgets",
      }, req.programTier);
    } catch { /* best-effort */ }
  } else {
    po.status = PO_STATUSES.REJECTED;
    po.rejectedReason = rejectedReason ? String(rejectedReason) : "Rejected by finance (PO review)";
  }
  await po.save();
  res.json({ message: "Finance PO review recorded", purchaseOrder: sanitizePO(po) });
}

async function createPurchaseOrder(req, res) {
  const { budgetId, vendorName, vendorContact, items, currency, notes } = req.body || {};
  if (!budgetId) throw new AppError("budgetId is required", 400);
  if (!vendorName) throw new AppError("vendorName is required", 400);
  if (!Array.isArray(items) || items.length === 0) throw new AppError("at least one item is required", 400);

  const budget =
    req.user.role === "researcher"
      ? await Budget.findOne({ _id: budgetId, ownerResearcherId: req.user.id })
      : await Budget.findOne(req.tierWhere({ _id: budgetId }));
  if (!budget) throw new AppError("Budget not found", 404);
  if (req.user.role === "researcher" && String(budget.ownerResearcherId) !== String(req.user.id)) {
    throw new AppError("Forbidden: budget does not belong to you", 403);
  }

  const cleanItems = items.map((it) => {
    if (!it.description) throw new AppError("each item must have a description", 400);
    if (typeof it.unitPrice !== "number" || it.unitPrice < 0) {
      throw new AppError("unitPrice must be a non-negative number", 400);
    }
    return {
      description: String(it.description).trim(),
      quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
      unitPrice: it.unitPrice,
    };
  });
  const estimatedTotal = cleanItems.reduce(
    (acc, it) => acc + Number(it.unitPrice || 0) * Number(it.quantity || 0),
    0
  );
  await assertAffordableWithCommitments(budget, estimatedTotal);

  const po = await PurchaseOrder.create(req.tierAssign({
    budgetId,
    vendorName: String(vendorName).trim(),
    vendorContact: vendorContact ? String(vendorContact).trim() : "",
    items: cleanItems,
    currency: currency ? String(currency).trim().toUpperCase() : budget.currency || "USD",
    projectId: budget.projectId || null,
    grantId: budget.grantId || null,
    requestedBy: req.user.id,
    notes: notes ? String(notes) : "",
    status: PO_STATUSES.REQUESTED,
    programTier: budget.programTier,
  }));

  try {
    await notifyUsersByRole("finance_officer", {
      type: "budget",
      title: "New purchase order awaiting finance review",
      body: `${po.vendorName} — ${po.currency} ${po.totalAmount}`,
      link: po.projectId ? `/budgets?projectId=${po.projectId}` : "/budgets",
    }, budget.programTier || req.programTier);
  } catch {
    /* best-effort */
  }

  res.status(201).json({ purchaseOrder: sanitizePO(po) });
}

async function directorDecision(req, res) {
  const { id } = req.params;
  const { decision, rejectedReason } = req.body || {};
  if (!["approve", "reject"].includes(decision)) {
    throw new AppError("decision must be 'approve' or 'reject'", 400);
  }
  const po = await PurchaseOrder.findOne(req.tierWhere({ _id: id }));
  if (!po) throw new AppError("Purchase order not found", 404);
  if (po.status !== PO_STATUSES.PROCUREMENT_APPROVED) {
    throw new AppError("PO must be finance-reviewed before director approval", 400);
  }

  if (decision === "approve") {
    po.status = PO_STATUSES.DIRECTOR_APPROVED;
    po.directorApprovedBy = req.user.id;
    po.directorApprovedAt = new Date();
    po.rejectedReason = "";
  } else {
    po.status = PO_STATUSES.REJECTED;
    po.rejectedReason = rejectedReason ? String(rejectedReason) : "Rejected by director";
  }
  await po.save();

  try {
    await notifyUser(po.requestedBy, {
      type: "budget",
      title: `PO ${decision === "approve" ? "approved by director" : "rejected by director"}`,
      body: po.vendorName,
      link: po.projectId ? `/budgets?projectId=${po.projectId}` : "/budgets",
      programTier: po.programTier || req.programTier,
    });
    if (decision === "approve") {
      await notifyUsersByRole("finance_officer", {
        type: "budget",
        title: "Director-approved PO awaiting payment",
        body: `${po.vendorName} — ${po.currency} ${po.totalAmount}`,
        link: po.projectId ? `/budgets?projectId=${po.projectId}` : "/budgets",
      }, po.programTier || req.programTier);
    }
  } catch {
    /* best-effort */
  }

  res.json({ message: "Director decision recorded", purchaseOrder: sanitizePO(po) });
}

async function financePay(req, res) {
  const { id } = req.params;
  const { paymentMethod, paymentMethodDetails, poNumber } = req.body || {};
  if (!paymentMethod || !Object.values(PO_PAYMENT_METHODS).includes(paymentMethod)) {
    throw new AppError(
      `paymentMethod is required. Allowed: ${Object.values(PO_PAYMENT_METHODS).join(", ")}`,
      400
    );
  }

  const claimed = await PurchaseOrder.findOneAndUpdate(
    req.tierWhere({ _id: id, status: PO_STATUSES.DIRECTOR_APPROVED }),
    {
      $set: {
        status: PO_STATUSES.PAID,
        paidBy: req.user.id,
        paidAt: new Date(),
        paymentMethod,
        paymentMethodDetails: paymentMethodDetails ? String(paymentMethodDetails) : "",
        ...(poNumber ? { poNumber: String(poNumber).trim() } : {}),
      },
    },
    { new: true }
  );
  if (!claimed) {
    const existing = await PurchaseOrder.findOne(req.tierWhere({ _id: id }));
    if (!existing) throw new AppError("Purchase order not found", 404);
    throw new AppError("PO must be approved by the director before payment", 400);
  }

  let budgetAfter;
  try {
    budgetAfter = await deductFromBudget(claimed.budgetId, claimed.totalAmount, { tierWhere: req.tierWhere });
  } catch (err) {
    await PurchaseOrder.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: PO_STATUSES.DIRECTOR_APPROVED,
          paidBy: null,
          paidAt: null,
          paymentMethod: undefined,
          paymentMethodDetails: "",
        },
      }
    );
    throw err;
  }
  const po = claimed;
try {
    await notifyUser(po.requestedBy, {
      type: "budget",
      title: "PO paid by finance",
      body: `${po.vendorName} via ${paymentMethod}`,
      link: po.projectId ? `/budgets?projectId=${po.projectId}` : "/budgets",
      programTier: po.programTier || req.programTier,
    });
  } catch {
    /* best-effort */
  }

  res.json({
    message: "PO paid",
    purchaseOrder: sanitizePO(po),
    budget: {
      id: budgetAfter._id,
      totalAllocated: budgetAfter.totalAllocated,
      totalDisbursed: budgetAfter.totalDisbursed || 0,
      remainingBalance: remainingOf(budgetAfter),
      currency: budgetAfter.currency,
    },
  });
}

async function financeReject(req, res) {
  const { id } = req.params;
  const { rejectedReason } = req.body || {};
  const po = await PurchaseOrder.findOne(req.tierWhere({ _id: id }));
  if (!po) throw new AppError("Purchase order not found", 404);
  if (po.status !== PO_STATUSES.DIRECTOR_APPROVED) {
    throw new AppError("Only director-approved POs can be rejected by finance", 400);
  }

  po.status = PO_STATUSES.REJECTED;
  po.rejectedReason = rejectedReason ? String(rejectedReason) : "Rejected by finance";
  await po.save();

  res.json({ message: "PO rejected by finance", purchaseOrder: sanitizePO(po) });
}

module.exports = {
  listPurchaseOrders,
  createPurchaseOrder,
  procurementDecision,
  directorDecision,
  financePay,
  financeReject,
};

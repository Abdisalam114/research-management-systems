const { Payment, PAYMENT_CATEGORIES, PAYMENT_STATUSES, PAYMENT_METHODS } = require("../models/Payment");
const { Budget } = require("../models/Budget");
const { AppError } = require("../utils/AppError");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");

function sanitizePayment(p) {
  const requestedByRef = p.requestedBy;
  const budgetRef = p.budgetId;
  const projectRef = p.projectId;
  const grantRef = p.grantId;
  return {
    id: p._id,
    category: p.category,
    budgetId: budgetRef?._id ? String(budgetRef._id) : budgetRef,
    payee: p.payee,
    purpose: p.purpose,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    requestedBy: requestedByRef?._id ? String(requestedByRef._id) : requestedByRef,
    directorApprovedBy: p.directorApprovedBy,
    directorApprovedAt: p.directorApprovedAt,
    paidBy: p.paidBy,
    paidAt: p.paidAt,
    paymentMethod: p.paymentMethod,
    paymentMethodDetails: p.paymentMethodDetails,
    rejectedReason: p.rejectedReason,
    referenceNumber: p.referenceNumber,
    projectId: projectRef?._id ? String(projectRef._id) : projectRef || null,
    grantId: grantRef?._id ? String(grantRef._id) : grantRef || null,
    notes: p.notes,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    programTier: p.programTier,
  };
}

function sanitizeUserProfile(user) {
  if (!user || !user._id) return null;
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    department: user.department,
    rank: user.rank,
  };
}

function sanitizeBudgetSummary(budget) {
  if (!budget || !budget._id) return null;
  const owner = budget.ownerResearcherId;
  return {
    id: budget._id,
    totalAllocated: budget.totalAllocated,
    currency: budget.currency,
    financeNotes: budget.financeNotes || "",
    owner: sanitizeUserProfile(owner?._id ? owner : null),
  };
}

function sanitizeProjectSummary(project) {
  if (!project || !project._id) return null;
  return {
    id: project._id,
    title: project.title,
    status: project.status,
  };
}

function sanitizeGrantSummary(grant) {
  if (!grant || !grant._id) return null;
  return {
    id: grant._id,
    title: grant.title,
    fundingSource: grant.fundingSource,
    amountAwarded: grant.amountAwarded,
    currency: grant.currency,
  };
}

function sanitizePaymentDetail(p) {
  const base = sanitizePayment(p);
  const budget = p.budgetId;
  return {
    ...base,
    requester: sanitizeUserProfile(p.requestedBy),
    budget: budget?._id ? sanitizeBudgetSummary(budget) : null,
    project: sanitizeProjectSummary(p.projectId),
    grant: sanitizeGrantSummary(p.grantId),
  };
}

async function getPayment(req, res) {
  const { id } = req.params;
  const payment = await Payment.findOne(req.tierWhere({ _id: id }))
    .populate("requestedBy", "fullName email department rank")
    .populate({
      path: "budgetId",
      select: "totalAllocated currency financeNotes ownerResearcherId",
      populate: { path: "ownerResearcherId", select: "fullName email department rank" },
    })
    .populate("projectId", "title status")
    .populate("grantId", "title fundingSource amountAwarded currency");
  if (!payment) throw new AppError("Payment not found", 404);

  const isOwner = String(payment.requestedBy?._id || payment.requestedBy) === String(req.user.id);
  const isStaff = ["research_director", "finance_officer"].includes(req.user.role);
  if (!isOwner && !isStaff) throw new AppError("Forbidden", 403);

  res.json({ payment: sanitizePaymentDetail(payment) });
}

async function listPayments(req, res) {
  const { role, id } = req.user;
  const filter = {};
  if (role === "researcher") filter.requestedBy = id;
  const payments = await Payment.find(req.tierWhere(filter)).sort({ createdAt: -1 });
  res.json({ payments: payments.map(sanitizePayment) });
}

async function createPayment(req, res) {
  const { category, budgetId, payee, purpose, amount, currency, notes } = req.body || {};
  if (!category || !Object.values(PAYMENT_CATEGORIES).includes(category)) {
    throw new AppError("Valid category is required", 400);
  }
  if (!budgetId) throw new AppError("budgetId is required", 400);
  if (!payee || !purpose) throw new AppError("payee and purpose are required", 400);
  if (typeof amount !== "number" || amount < 0) throw new AppError("amount must be a non-negative number", 400);

  const budget = await Budget.findOne(req.tierWhere({ _id: budgetId }));
  if (!budget) throw new AppError("Budget not found", 404);
  if (req.user.role === "researcher" && String(budget.ownerResearcherId) !== String(req.user.id)) {
    throw new AppError("Forbidden: budget does not belong to you", 403);
  }

  const payment = await Payment.create(req.tierAssign({
    category,
    budgetId,
    payee: String(payee).trim(),
    purpose: String(purpose).trim(),
    amount,
    currency: currency ? String(currency).trim().toUpperCase() : budget.currency || "USD",
    requestedBy: req.user.id,
    projectId: budget.projectId || null,
    grantId: budget.grantId || null,
    notes: notes ? String(notes) : "",
    status: PAYMENT_STATUSES.REQUESTED,
  }));

  // #region agent log
  fetch('http://127.0.0.1:7385/ingest/4af2e467-e1e9-4128-940b-32687334c4e9', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6113cc' },
    body: JSON.stringify({
      sessionId: '6113cc', hypothesisId: 'H1', location: 'paymentController.js:createPayment',
      message: 'Payment created', data: { id: String(payment._id), budgetId: String(payment.budgetId), status: payment.status, amount: payment.amount },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  try {
    await notifyUsersByRole("research_director", {
      type: "payment",
      title: "New payment request awaiting director approval",
      body: `${payment.payee}: ${payment.purpose}`,
      link: "/budgets",
    });
  } catch {
    /* best-effort */
  }

  res.status(201).json({ payment: sanitizePayment(payment) });
}

async function directorDecision(req, res) {
  const { id } = req.params;
  const { decision, rejectedReason } = req.body || {};
  if (!["approve", "reject"].includes(decision)) {
    throw new AppError("decision must be 'approve' or 'reject'", 400);
  }
  const payment = await Payment.findOne(req.tierWhere({ _id: id }));
  if (!payment) throw new AppError("Payment not found", 404);
  if (payment.status !== PAYMENT_STATUSES.REQUESTED) {
    throw new AppError("Payment is not in requested status", 400);
  }

  if (decision === "approve") {
    payment.status = PAYMENT_STATUSES.DIRECTOR_APPROVED;
    payment.directorApprovedBy = req.user.id;
    payment.directorApprovedAt = new Date();
    payment.rejectedReason = "";
  } else {
    payment.status = PAYMENT_STATUSES.REJECTED;
    payment.rejectedReason = rejectedReason ? String(rejectedReason) : "Rejected by director";
  }
  await payment.save();

  // #region agent log
  fetch('http://127.0.0.1:7385/ingest/4af2e467-e1e9-4128-940b-32687334c4e9', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6113cc' },
    body: JSON.stringify({
      sessionId: '6113cc', hypothesisId: 'H2', location: 'paymentController.js:directorDecision',
      message: 'Director decided on payment', data: { id: String(payment._id), decision, status: payment.status },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  try {
    await notifyUser(payment.requestedBy, {
      type: "payment",
      title: `Payment ${decision === "approve" ? "approved by director" : "rejected by director"}`,
      body: `${payment.payee} — ${payment.purpose}`,
      link: "/budgets",
    });
    if (decision === "approve") {
      await notifyUsersByRole("finance_officer", {
        type: "payment",
        title: "Director-approved payment awaiting disbursement",
        body: `${payment.payee} — ${payment.purpose}`,
        link: "/budgets",
      });
    }
  } catch {
    /* best-effort */
  }

  res.json({ message: "Director decision recorded", payment: sanitizePayment(payment) });
}

async function financePay(req, res) {
  const { id } = req.params;
  const { paymentMethod, paymentMethodDetails, referenceNumber } = req.body || {};
  if (!paymentMethod || !Object.values(PAYMENT_METHODS).includes(paymentMethod)) {
    throw new AppError(
      `paymentMethod is required. Allowed: ${Object.values(PAYMENT_METHODS).join(", ")}`,
      400
    );
  }

  const payment = await Payment.findOne(req.tierWhere({ _id: id }));
  if (!payment) throw new AppError("Payment not found", 404);
  if (payment.status !== PAYMENT_STATUSES.DIRECTOR_APPROVED) {
    throw new AppError("Payment must be approved by the director before payment", 400);
  }

  payment.status = PAYMENT_STATUSES.PAID;
  payment.paidBy = req.user.id;
  payment.paidAt = new Date();
  payment.paymentMethod = paymentMethod;
  payment.paymentMethodDetails = paymentMethodDetails ? String(paymentMethodDetails) : "";
  if (referenceNumber) payment.referenceNumber = String(referenceNumber).trim();
  await payment.save();

  // #region agent log
  fetch('http://127.0.0.1:7385/ingest/4af2e467-e1e9-4128-940b-32687334c4e9', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6113cc' },
    body: JSON.stringify({
      sessionId: '6113cc', hypothesisId: 'H3', location: 'paymentController.js:financePay',
      message: 'Finance paid', data: { id: String(payment._id), paymentMethod: payment.paymentMethod, status: payment.status, paidAt: payment.paidAt },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  try {
    await notifyUser(payment.requestedBy, {
      type: "payment",
      title: "Payment disbursed by finance",
      body: `${payment.payee} — ${payment.purpose} via ${paymentMethod}`,
      link: "/budgets",
    });
  } catch {
    /* best-effort */
  }

  res.json({ message: "Payment disbursed", payment: sanitizePayment(payment) });
}

async function financeReject(req, res) {
  const { id } = req.params;
  const { rejectedReason } = req.body || {};
  const payment = await Payment.findOne(req.tierWhere({ _id: id }));
  if (!payment) throw new AppError("Payment not found", 404);
  if (payment.status !== PAYMENT_STATUSES.DIRECTOR_APPROVED) {
    throw new AppError("Only director-approved payments can be rejected by finance", 400);
  }

  payment.status = PAYMENT_STATUSES.REJECTED;
  payment.rejectedReason = rejectedReason ? String(rejectedReason) : "Rejected by finance";
  await payment.save();

  res.json({ message: "Payment rejected by finance", payment: sanitizePayment(payment) });
}

module.exports = {
  listPayments,
  getPayment,
  createPayment,
  directorDecision,
  financePay,
  financeReject,
};

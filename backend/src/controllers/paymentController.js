const { Payment, PAYMENT_CATEGORIES, PAYMENT_STATUSES, PAYMENT_METHODS } = require("../models/Payment");
const { Budget } = require("../models/Budget");
const { AppError } = require("../utils/AppError");
const { notifyUser, notifyUsersByRole } = require("../utils/notify");
const { deductFromBudget, assertAffordableWithCommitments, remainingOf } = require("../utils/budgetDisbursement");

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
    totalDisbursed: budget.totalDisbursed || 0,
    remainingBalance: remainingOf(budget),
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
  const paymentFilter =
    req.user.role === "researcher"
      ? { _id: id, requestedBy: req.user.id }
      : req.tierWhere({ _id: id });
  const payment = await Payment.findOne(paymentFilter)
    .populate("requestedBy", "fullName email department rank")
    .populate({
      path: "budgetId",
      select: "totalAllocated totalDisbursed currency financeNotes ownerResearcherId",
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
  const filter =
    role === "researcher"
      ? req.ownedWhere({}, { ownerField: "requestedBy" })
      : req.tierWhere({});
  const payments = await Payment.find(filter).sort({ createdAt: -1 });
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

  const budget =
    req.user.role === "researcher"
      ? await Budget.findOne({ _id: budgetId, ownerResearcherId: req.user.id })
      : await Budget.findOne(req.tierWhere({ _id: budgetId }));
  if (!budget) throw new AppError("Budget not found", 404);
  if (req.user.role === "researcher" && String(budget.ownerResearcherId) !== String(req.user.id)) {
    throw new AppError("Forbidden: budget does not belong to you", 403);
  }
  await assertAffordableWithCommitments(budget, amount);

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
    programTier: budget.programTier,
  }));
try {
    await notifyUsersByRole("research_director", {
      type: "budget",
      title: "New payment request awaiting director approval",
      body: `${payment.payee}: ${payment.purpose}`,
      link: payment.projectId ? `/budgets?projectId=${payment.projectId}` : "/budgets",
    }, payment.programTier || budget.programTier || req.programTier);
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
try {
    await notifyUser(payment.requestedBy, {
      type: "budget",
      title: `Payment ${decision === "approve" ? "approved by director" : "rejected by director"}`,
      body: `${payment.payee} — ${payment.purpose}`,
      link: payment.projectId ? `/budgets?projectId=${payment.projectId}` : "/budgets",
      programTier: payment.programTier || req.programTier,
    });
    if (decision === "approve") {
      await notifyUsersByRole("finance_officer", {
        type: "budget",
        title: "Director-approved payment awaiting disbursement",
        body: `${payment.payee} — ${payment.purpose}`,
        link: payment.projectId ? `/budgets?projectId=${payment.projectId}` : "/budgets",
      }, payment.programTier || req.programTier);
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

  const claimed = await Payment.findOneAndUpdate(
    req.tierWhere({ _id: id, status: PAYMENT_STATUSES.DIRECTOR_APPROVED }),
    {
      $set: {
        status: PAYMENT_STATUSES.PAID,
        paidBy: req.user.id,
        paidAt: new Date(),
        paymentMethod,
        paymentMethodDetails: paymentMethodDetails ? String(paymentMethodDetails) : "",
        ...(referenceNumber ? { referenceNumber: String(referenceNumber).trim() } : {}),
      },
    },
    { new: true }
  );
  if (!claimed) {
    const existing = await Payment.findOne(req.tierWhere({ _id: id }));
    if (!existing) throw new AppError("Payment not found", 404);
    throw new AppError("Payment must be approved by the director before payment", 400);
  }

  let budgetAfter;
  try {
    budgetAfter = await deductFromBudget(claimed.budgetId, claimed.amount, { tierWhere: req.tierWhere });
  } catch (err) {
    await Payment.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: PAYMENT_STATUSES.DIRECTOR_APPROVED,
          paidBy: null,
          paidAt: null,
          paymentMethod: undefined,
          paymentMethodDetails: "",
        },
      }
    );
    throw err;
  }
  const payment = claimed;
try {
    await notifyUser(payment.requestedBy, {
      type: "budget",
      title: "Payment disbursed by finance",
      body: `${payment.payee} — ${payment.purpose} via ${paymentMethod}`,
      link: payment.projectId ? `/budgets?projectId=${payment.projectId}` : "/budgets",
      programTier: payment.programTier || req.programTier,
    });
  } catch {
    /* best-effort */
  }

  res.json({
    message: "Payment disbursed",
    payment: sanitizePayment(payment),
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

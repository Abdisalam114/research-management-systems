const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const paymentController = require("../controllers/paymentController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "finance_officer", "research_director"),
  asyncHandler(paymentController.listPayments)
);

router.get(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "finance_officer", "research_director"),
  asyncHandler(paymentController.getPayment)
);

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(paymentController.createPayment)
);

router.post(
  "/:id/director-decision",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(paymentController.directorDecision)
);

router.post(
  "/:id/pay",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("finance_officer"),
  asyncHandler(paymentController.financePay)
);

router.post(
  "/:id/reject",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("finance_officer"),
  asyncHandler(paymentController.financeReject)
);

module.exports = { paymentRoutes: router };

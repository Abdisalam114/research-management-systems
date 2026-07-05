const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const purchaseOrderController = require("../controllers/purchaseOrderController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "finance_officer", "research_director", "procurement_officer"),
  asyncHandler(purchaseOrderController.listPurchaseOrders)
);

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(purchaseOrderController.createPurchaseOrder)
);

router.post(
  "/:id/procurement-decision",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("procurement_officer"),
  asyncHandler(purchaseOrderController.procurementDecision)
);

router.post(
  "/:id/director-decision",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(purchaseOrderController.directorDecision)
);

router.post(
  "/:id/pay",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("finance_officer"),
  asyncHandler(purchaseOrderController.financePay)
);

router.post(
  "/:id/reject",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("finance_officer"),
  asyncHandler(purchaseOrderController.financeReject)
);

module.exports = { purchaseOrderRoutes: router };

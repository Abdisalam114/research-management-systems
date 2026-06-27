const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const budgetController = require("../controllers/budgetController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(budgetController.listBudgets));
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(budgetController.getBudget));

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(budgetController.createBudget)
);

router.post(
  "/:id/items",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(budgetController.addBudgetItem)
);

router.patch(
  "/:id/items/:itemId",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("finance_officer"),
  asyncHandler(budgetController.financeUpdateItemStatus)
);

module.exports = { budgetRoutes: router };


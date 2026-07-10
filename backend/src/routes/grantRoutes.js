const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const grantController = require("../controllers/grantController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(grantController.listGrants));
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(grantController.getGrant));

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(grantController.createGrant)
);
router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(grantController.updateGrant)
);
router.post(
  "/:id/submit",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(grantController.submitGrant)
);

router.post(
  "/:id/director-decision",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director", "leadership"),
  asyncHandler(grantController.directorDecision)
);

router.post(
  "/:id/finance-decision",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("finance_officer"),
  asyncHandler(grantController.financeDecision)
);

module.exports = { grantRoutes: router };


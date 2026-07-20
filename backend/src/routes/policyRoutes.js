const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const policyController = require("../controllers/policyController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");
const { SYSTEM_ROLES } = require("../constants/systemRoles");

const router = express.Router();

router.get(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles(...SYSTEM_ROLES),
  asyncHandler(policyController.listPolicies)
);

router.get(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles(...SYSTEM_ROLES),
  asyncHandler(policyController.getPolicy)
);

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("leadership"),
  asyncHandler(policyController.createPolicy)
);

router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("leadership"),
  asyncHandler(policyController.updatePolicy)
);

router.delete(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("leadership"),
  asyncHandler(policyController.deletePolicy)
);

module.exports = { policyRoutes: router };

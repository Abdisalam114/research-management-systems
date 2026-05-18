const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const policyController = require("../controllers/policyController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(policyController.listPolicies));

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(policyController.createPolicy)
);

router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(policyController.updatePolicy)
);

module.exports = { policyRoutes: router };

const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const auditController = require("../controllers/auditController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/recent",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director", "faculty_coordinator"),
  asyncHandler(auditController.listRecentAudit)
);
router.get(
  "/:entityType/:entityId",
  authenticateUser,
  requireActiveUser,
  asyncHandler(auditController.getEntityAudit)
);

module.exports = { auditRoutes: router };

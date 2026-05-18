const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const analyticsController = require("../controllers/analyticsController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard", authenticateUser, requireActiveUser, asyncHandler(analyticsController.getDashboardMetrics));

router.get(
  "/institutional",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(analyticsController.getInstitutionalAnalytics)
);

module.exports = { analyticsRoutes: router };


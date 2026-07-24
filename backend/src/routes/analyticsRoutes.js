const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const analyticsController = require("../controllers/analyticsController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/dashboard", authenticateUser, requireActiveUser, asyncHandler(analyticsController.getDashboardMetrics));

router.get(
  "/kpi-dashboard",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director", "leadership", "finance_officer", "faculty_coordinator"),
  asyncHandler(analyticsController.getKpiDashboard)
);

router.get(
  "/institutional",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(analyticsController.getInstitutionalAnalytics)
);

router.get(
  "/annual-report.pdf",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(analyticsController.exportAnnualReportPdf)
);

router.get(
  "/finance-report",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director", "finance_officer"),
  asyncHandler(analyticsController.getFinanceReport)
);

router.get(
  "/faculty-report",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator", "research_director"),
  asyncHandler(analyticsController.getFacultyReport)
);

router.get(
  "/faculty-report.pdf",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator", "research_director"),
  asyncHandler(analyticsController.exportFacultyReportPdf)
);

router.get(
  "/donor-report",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director", "finance_officer"),
  asyncHandler(analyticsController.getDonorReport)
);

router.get(
  "/research-journey",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "faculty_coordinator", "research_director"),
  asyncHandler(analyticsController.getResearchJourney)
);

module.exports = { analyticsRoutes: router };


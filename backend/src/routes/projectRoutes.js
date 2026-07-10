const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const projectController = require("../controllers/projectController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(projectController.listProjects));
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(projectController.getProject));

router.get(
  "/:id/technical-report.pdf",
  authenticateUser,
  requireActiveUser,
  asyncHandler(projectController.exportTechnicalReportPdf)
);

router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "research_director", "faculty_coordinator"),
  asyncHandler(projectController.updateProject)
);

router.post(
  "/:id/progress",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(projectController.addProgressReport)
);

// Research Director only helper (MVP) for already-approved proposals
router.post(
  "/from-approved-proposal/:proposalId",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(projectController.backfillProjectFromApprovedProposal)
);

router.post(
  "/:id/communication",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "research_director", "faculty_coordinator", "finance_officer", "procurement_officer"),
  asyncHandler(projectController.addCommunicationLog)
);

router.post(
  "/:id/closure/submit",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(projectController.submitClosure)
);
router.post(
  "/:id/closure/director-approve",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(projectController.directorClosureApproval)
);
router.post(
  "/:id/closure/finance-approve",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("finance_officer"),
  asyncHandler(projectController.financeClosureApproval)
);
router.post(
  "/:id/closure/archive",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(projectController.archiveProject)
);

module.exports = { projectRoutes: router };


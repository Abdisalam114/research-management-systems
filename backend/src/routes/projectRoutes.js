const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const projectController = require("../controllers/projectController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(projectController.listProjects));
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(projectController.getProject));

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

module.exports = { projectRoutes: router };


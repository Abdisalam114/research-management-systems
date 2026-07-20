const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const publicationController = require("../controllers/publicationController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(publicationController.listPublications));
router.get(
  "/faculty-workflow",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "faculty_coordinator", "research_director"),
  asyncHandler(publicationController.getFacultyWorkflow)
);
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(publicationController.getPublication));

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(publicationController.createPublication)
);
router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(publicationController.updatePublication)
);
router.post(
  "/:id/submit",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(publicationController.submitPublication)
);

router.post(
  "/:id/validate",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator", "research_director"),
  asyncHandler(publicationController.validatePublication)
);

router.post(
  "/:id/citations/refresh",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "faculty_coordinator", "research_director"),
  asyncHandler(publicationController.refreshCitations)
);

router.patch(
  "/:id/workflow-stage",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator", "research_director"),
  asyncHandler(publicationController.updateWorkflowStage)
);

router.delete(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "research_director"),
  asyncHandler(publicationController.deletePublication)
);

module.exports = { publicationRoutes: router };


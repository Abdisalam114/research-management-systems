const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const proposalController = require("../controllers/proposalController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(proposalController.listProposals));
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(proposalController.getProposal));

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  upload.single("document"),
  asyncHandler(proposalController.createProposal)
);

router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  upload.single("document"),
  asyncHandler(proposalController.updateProposal)
);

router.post(
  "/:id/submit",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(proposalController.submitProposal)
);

router.post(
  "/:id/review",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator"),
  asyncHandler(proposalController.coordinatorReview)
);

router.post(
  "/:id/director-decision",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(proposalController.directorDecision)
);

router.post(
  "/:id/ethics-decision",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director", "faculty_coordinator"),
  asyncHandler(proposalController.ethicsDecision)
);

router.post(
  "/:id/assign-reviewers",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(proposalController.assignReviewers)
);

module.exports = { proposalRoutes: router };


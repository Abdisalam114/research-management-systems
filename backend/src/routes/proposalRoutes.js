const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const proposalController = require("../controllers/proposalController");
const proposalReviewController = require("../controllers/proposalReviewController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");
const { requireObjectIdParam } = require("../middleware/validateParams");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(proposalController.listProposals));
router.get(
  "/my-review-assignments",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("leadership", "research_director"),
  asyncHandler(proposalReviewController.listMyReviewAssignments)
);
router.get(
  "/my-committee-assignments",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator", "research_director"),
  asyncHandler(proposalReviewController.listMyCommitteeAssignments)
);
router.get(
  "/:id/ethics-application",
  authenticateUser,
  requireActiveUser,
  requireObjectIdParam("id"),
  asyncHandler(proposalController.getProposalEthicsApplication)
);
router.get(
  "/:id",
  authenticateUser,
  requireActiveUser,
  requireObjectIdParam("id"),
  asyncHandler(proposalController.getProposal)
);

const proposalUpload = upload.fields([
  { name: "document", maxCount: 1 },
  { name: "complianceFiles", maxCount: 8 },
  { name: "supportingFiles", maxCount: 8 },
]);

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  proposalUpload,
  asyncHandler(proposalController.createProposal)
);

router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  proposalUpload,
  asyncHandler(proposalController.updateProposal)
);

router.delete(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "research_director"),
  asyncHandler(proposalController.deleteProposal)
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

router.post(
  "/:id/assign-committee",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(proposalController.assignCommittee)
);

router.post(
  "/:id/assign-finance",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(proposalController.assignFinance)
);

router.post(
  "/:id/admin-screening",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator", "research_director"),
  asyncHandler(proposalReviewController.adminScreening)
);
router.post(
  "/:id/peer-review",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("leadership", "research_director"),
  asyncHandler(proposalReviewController.submitPeerReview)
);
router.post(
  "/:id/complete-peer-review",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(proposalReviewController.completePeerReview)
);
router.post(
  "/:id/committee-review",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator", "research_director"),
  asyncHandler(proposalReviewController.committeeReview)
);
router.post(
  "/:id/finance-review",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("finance_officer"),
  asyncHandler(proposalReviewController.financeProposalReview)
);

module.exports = { proposalRoutes: router };


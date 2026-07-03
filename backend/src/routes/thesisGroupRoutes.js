const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const thesisGroupController = require("../controllers/thesisGroupController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(thesisGroupController.listGroups));
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(thesisGroupController.getGroup));

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator", "research_director"),
  asyncHandler(thesisGroupController.createGroup)
);

router.patch(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator", "research_director"),
  asyncHandler(thesisGroupController.updateGroup)
);

router.post(
  "/:id/title-proposal",
  authenticateUser,
  requireActiveUser,
  asyncHandler(thesisGroupController.proposeTitle)
);

router.post(
  "/:id/title-proposal/review",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("faculty_coordinator", "research_director"),
  asyncHandler(thesisGroupController.reviewTitleProposal)
);

router.patch(
  "/:id/chapters/:chapterKey",
  authenticateUser,
  requireActiveUser,
  asyncHandler(thesisGroupController.updateChapter)
);

router.post(
  "/:id/meetings",
  authenticateUser,
  requireActiveUser,
  asyncHandler(thesisGroupController.addMeeting)
);

router.delete(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(thesisGroupController.deleteGroup)
);

module.exports = { thesisGroupRoutes: router };

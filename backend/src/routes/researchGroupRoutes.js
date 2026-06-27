const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const researchGroupController = require("../controllers/researchGroupController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(researchGroupController.listGroups));
router.get("/stats", authenticateUser, requireActiveUser, asyncHandler(researchGroupController.getGroupStats));
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(researchGroupController.getGroup));

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "faculty_coordinator", "research_director"),
  asyncHandler(researchGroupController.createGroup)
);

router.post("/:id/join", authenticateUser, requireActiveUser, asyncHandler(researchGroupController.joinGroup));
router.post("/:id/leave", authenticateUser, requireActiveUser, asyncHandler(researchGroupController.leaveGroup));

router.delete("/:id", authenticateUser, requireActiveUser, asyncHandler(researchGroupController.deleteGroup));

module.exports = { researchGroupRoutes: router };


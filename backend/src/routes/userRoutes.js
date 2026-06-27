const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const userController = require("../controllers/userController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// Research Director only (institutional admin)
router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(userController.createUserByDirector)
);

router.get(
  "/pending",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(userController.listPendingUsers)
);

router.get(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(userController.listUsers)
);

router.post(
  "/:id/approve",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(userController.approveUser)
);

router.post(
  "/:id/reject",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(userController.rejectUser)
);

router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(userController.updateUserByDirector)
);

router.delete(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(userController.deleteUserByDirector)
);

// Any active user
router.put("/me", authenticateUser, requireActiveUser, asyncHandler(userController.updateMyProfile));

module.exports = { userRoutes: router };


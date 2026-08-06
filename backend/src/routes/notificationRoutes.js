const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notificationController = require("../controllers/notificationController");
const { authenticateUser, requireActiveUser } = require("../middleware/auth");

const router = express.Router();

router.get("/me", authenticateUser, requireActiveUser, asyncHandler(notificationController.listMyNotifications));
router.get("/me/unread-count", authenticateUser, requireActiveUser, asyncHandler(notificationController.unreadCount));
router.post("/me/read-all", authenticateUser, requireActiveUser, asyncHandler(notificationController.markAllRead));
router.post("/me/clear", authenticateUser, requireActiveUser, asyncHandler(notificationController.clearAll));
router.post("/:id/read", authenticateUser, requireActiveUser, asyncHandler(notificationController.markRead));

module.exports = { notificationRoutes: router };


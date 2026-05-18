const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const conversationController = require("../controllers/conversationController");
const { authenticateUser, requireActiveUser } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(conversationController.listMyConversations));
router.post("/", authenticateUser, requireActiveUser, asyncHandler(conversationController.createConversation));
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(conversationController.getConversation));
router.post("/:id/messages", authenticateUser, requireActiveUser, asyncHandler(conversationController.sendMessage));

module.exports = { conversationRoutes: router };


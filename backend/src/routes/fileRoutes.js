const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const fileController = require("../controllers/fileController");
const { authenticateUser, requireActiveUser } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(fileController.downloadUpload));

module.exports = { fileRoutes: router };

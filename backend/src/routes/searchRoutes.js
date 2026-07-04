const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const searchController = require("../controllers/searchController");
const { authenticateUser, requireActiveUser } = require("../middleware/auth");

const router = express.Router();
router.get("/", authenticateUser, requireActiveUser, asyncHandler(searchController.globalSearch));
module.exports = { searchRoutes: router };

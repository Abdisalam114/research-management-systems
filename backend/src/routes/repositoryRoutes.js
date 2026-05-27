const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const repositoryController = require("../controllers/repositoryController");
const { authenticateUser, requireActiveUser } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(repositoryController.listItems));
router.get("/oai/export", asyncHandler(repositoryController.oaiExport));
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(repositoryController.getItem));

router.post(
  "/upload",
  authenticateUser,
  requireActiveUser,
  upload.single("file"),
  asyncHandler(repositoryController.uploadItem)
);

module.exports = { repositoryRoutes: router };


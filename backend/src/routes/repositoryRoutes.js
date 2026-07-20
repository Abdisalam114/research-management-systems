const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const repositoryController = require("../controllers/repositoryController");
const { AppError } = require("../utils/AppError");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");
const { repositoryUpload } = require("../middleware/repositoryUpload");

const router = express.Router();

const RESERVED_IDS = new Set(["oai", "upload", "export"]);

function blockReservedRepoIds(req, res, next) {
  if (RESERVED_IDS.has(req.params.id)) {
    return next(new AppError("Not found", 404));
  }
  next();
}

router.get("/", authenticateUser, requireActiveUser, asyncHandler(repositoryController.listItems));
router.get("/export/csv", authenticateUser, requireActiveUser, asyncHandler(repositoryController.exportRepositoryCsv));
router.get("/export/pdf", authenticateUser, requireActiveUser, asyncHandler(repositoryController.exportRepositoryPdf));
router.get("/export/excel", authenticateUser, requireActiveUser, asyncHandler(repositoryController.exportRepositoryExcel));
router.get("/:id", authenticateUser, requireActiveUser, blockReservedRepoIds, asyncHandler(repositoryController.getItem));

router.post(
  "/upload",
  authenticateUser,
  requireActiveUser,
  repositoryUpload.single("file"),
  asyncHandler(repositoryController.uploadItem)
);

router.delete(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "research_director"),
  blockReservedRepoIds,
  asyncHandler(repositoryController.deleteItem)
);

module.exports = { repositoryRoutes: router };

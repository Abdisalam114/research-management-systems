const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const departmentController = require("../controllers/departmentController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(departmentController.listDepartments));

// Director manages departments
router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(departmentController.createDepartment)
);
router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(departmentController.updateDepartment)
);
router.delete(
  "/by-faculty/:faculty",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(departmentController.deleteDepartmentsByFaculty)
);
router.delete(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(departmentController.deleteDepartment)
);

module.exports = { departmentRoutes: router };


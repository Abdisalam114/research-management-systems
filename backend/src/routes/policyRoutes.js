const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const policyController = require("../controllers/policyController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles(
    "leadership",
    "research_director",
    "faculty_coordinator",
    "finance_officer",
    "researcher",
    "donor_agency",
    "ethics_committee"
  ),
  asyncHandler(policyController.listPolicies)
);

router.get(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles(
    "leadership",
    "research_director",
    "faculty_coordinator",
    "finance_officer",
    "researcher",
    "donor_agency",
    "ethics_committee"
  ),
  asyncHandler(policyController.getPolicy)
);

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("leadership"),
  asyncHandler(policyController.createPolicy)
);

router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("leadership"),
  asyncHandler(policyController.updatePolicy)
);

router.delete(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("leadership"),
  asyncHandler(policyController.deletePolicy)
);

module.exports = { policyRoutes: router };

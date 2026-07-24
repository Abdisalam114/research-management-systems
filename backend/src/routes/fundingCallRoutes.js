const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fundingCallController = require("../controllers/fundingCallController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticateUser, requireActiveUser, asyncHandler(fundingCallController.listFundingCalls));
router.get("/:id", authenticateUser, requireActiveUser, asyncHandler(fundingCallController.getFundingCall));

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(fundingCallController.createFundingCall)
);
router.put(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director", "leadership"),
  asyncHandler(fundingCallController.updateFundingCall)
);
router.post(
  "/:id/publish",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("leadership", "research_director"),
  asyncHandler(fundingCallController.publishFundingCall)
);
router.post(
  "/:id/close",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("leadership", "research_director"),
  asyncHandler(fundingCallController.closeFundingCall)
);

module.exports = { fundingCallRoutes: router };

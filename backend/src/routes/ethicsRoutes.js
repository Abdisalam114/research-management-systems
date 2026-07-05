const express = require("express");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ethicsController = require("../controllers/ethicsController");
const { authenticateUser, requireActiveUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "faculty_coordinator", "research_director", "ethics_committee"),
  asyncHandler(ethicsController.listEthicsApplications)
);

router.get(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "faculty_coordinator", "research_director", "ethics_committee"),
  asyncHandler(ethicsController.getEthicsApplication)
);

router.get(
  "/:id/certificate-preview",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director"),
  asyncHandler(ethicsController.previewCertificate)
);

router.get(
  "/:id/certificate.pdf",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher", "faculty_coordinator", "research_director"),
  asyncHandler(ethicsController.downloadCertificate)
);

router.post(
  "/",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(ethicsController.createEthicsApplication)
);

router.patch(
  "/:id",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(ethicsController.updateEthicsApplication)
);

router.post(
  "/:id/submit",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("researcher"),
  asyncHandler(ethicsController.submitEthicsApplication)
);

router.post(
  "/:id/director-decision",
  authenticateUser,
  requireActiveUser,
  authorizeRoles("research_director", "ethics_committee"),
  asyncHandler(ethicsController.directorDecision)
);

module.exports = { ethicsRoutes: router };

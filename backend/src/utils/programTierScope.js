const { AppError } = require("./AppError");
const { ROLES } = require("../models/User");
const {
  PROGRAM_TIERS,
  PROGRAM_TIER_HEADER,
  isValidProgramTier,
} = require("../constants/programTier");

function resolveProgramTier(req, user) {
  const headerTier = String(req.headers[PROGRAM_TIER_HEADER] || "").toLowerCase();

  if (user.role === ROLES.RESEARCH_DIRECTOR) {
    if (!isValidProgramTier(headerTier)) {
      throw new AppError(
        "Program tier selection required. Choose Undergraduate or Postgraduate.",
        428,
        "PROGRAM_TIER_REQUIRED"
      );
    }
    return headerTier;
  }

  if (user.programTier && isValidProgramTier(user.programTier)) {
    return user.programTier;
  }

  return PROGRAM_TIERS.UNDERGRADUATE;
}

function tierWhere(req, base = {}) {
  if (!req.programTier) return base;
  return { ...base, programTier: req.programTier };
}

function tierAssign(req, data = {}) {
  if (!req.programTier) return data;
  return { ...data, programTier: req.programTier };
}

function assertTierDocument(req, doc) {
  if (!doc) return;
  if (doc.programTier && doc.programTier !== req.programTier) {
    throw new AppError("Not found", 404);
  }
}

function attachProgramTierHelpers(req) {
  req.tierWhere = (base = {}) => tierWhere(req, base);
  req.tierAssign = (data = {}) => tierAssign(req, data);
  req.assertTierDocument = (doc) => assertTierDocument(req, doc);
}

module.exports = {
  resolveProgramTier,
  tierWhere,
  tierAssign,
  assertTierDocument,
  attachProgramTierHelpers,
};

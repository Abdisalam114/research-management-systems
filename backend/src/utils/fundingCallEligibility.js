const { AppError } = require("./AppError");
const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");

function tierMatchesCall(req, call) {
  if (!call) return false;
  // Director / staff without an active portal filter may open any call
  if (!req.programTier) return true;
  const pt = req.programTier === "undergraduate" ? "ug" : "pg";
  if (call.eligibilityTier === "ug") return pt === "ug";
  if (call.eligibilityTier === "pg" || call.eligibilityTier === "pgd") return pt === "pg";
  // Cross-portal call — visible and eligible on both UG and PG portals
  if (call.eligibilityTier === "all") return true;
  return call.programTier === req.programTier;
}

function assertEligibleForCall(req, call) {
  if (!call) throw new AppError("Funding call is required", 400);
  if (!tierMatchesCall(req, call)) {
    throw new AppError("You are not eligible for this funding call (portal tier mismatch)", 403);
  }
  if (call.deadline && new Date(call.deadline) < new Date()) {
    throw new AppError("Funding call deadline has passed", 400);
  }
}

/** Open funding call on the active portal only (strict UG/PG isolation). */
async function findOpenEligibleCall(req, callId) {
  if (!callId) return null;
  const call = await FundingCall.findOne({ _id: callId, status: CALL_STATUSES.OPEN });
  if (!call) return null;
  if (!tierMatchesCall(req, call)) {
    throw new AppError("You are not eligible for this funding call (portal tier mismatch)", 403);
  }
  return call;
}

module.exports = { tierMatchesCall, assertEligibleForCall, findOpenEligibleCall };

const { AppError } = require("./AppError");
const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");

function tierMatchesCall(req, call) {
  if (!call || call.eligibilityTier === "all") return true;
  const pt = req.programTier === "undergraduate" ? "ug" : "pg";
  if (call.eligibilityTier === "ug") return pt === "ug";
  if (call.eligibilityTier === "pg" || call.eligibilityTier === "pgd") return pt === "pg";
  return true;
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

/**
 * Open funding call for the active portal, or (researchers only) an eligible
 * call published on the other portal when eligibilityTier is all/ug/pg/pgd.
 */
async function findOpenEligibleCall(req, callId) {
  if (!callId) return null;
  let call = await FundingCall.findOne(req.tierWhere({ _id: callId, status: CALL_STATUSES.OPEN }));
  if (!call && req.user?.role === "researcher") {
    call = await FundingCall.findOne({ _id: callId, status: CALL_STATUSES.OPEN });
    if (call && !tierMatchesCall(req, call)) {
      throw new AppError("You are not eligible for this funding call (portal tier mismatch)", 403);
    }
  }
  return call;
}

module.exports = { tierMatchesCall, assertEligibleForCall, findOpenEligibleCall };

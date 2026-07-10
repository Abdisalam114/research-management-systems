const { AppError } = require("./AppError");

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

module.exports = { tierMatchesCall, assertEligibleForCall };

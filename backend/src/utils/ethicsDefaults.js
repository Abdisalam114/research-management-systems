const { PROGRAM_TIERS } = require("../constants/programTier");

/** Default ethics projectLevel — same rules for UG and PG portals. */
function defaultEthicsProjectLevel(programTier) {
  if (programTier === PROGRAM_TIERS.UNDERGRADUATE) return "undergraduate";
  if (programTier === PROGRAM_TIERS.POSTGRADUATE) return "master";
  return "";
}

module.exports = { defaultEthicsProjectLevel };

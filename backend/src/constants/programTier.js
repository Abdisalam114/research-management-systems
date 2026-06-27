const PROGRAM_TIERS = Object.freeze({
  UNDERGRADUATE: "undergraduate",
  POSTGRADUATE: "postgraduate",
});

const PROGRAM_TIER_VALUES = Object.freeze(Object.values(PROGRAM_TIERS));
const PROGRAM_TIER_HEADER = "x-program-tier";

function isValidProgramTier(value) {
  return PROGRAM_TIER_VALUES.includes(value);
}

module.exports = {
  PROGRAM_TIERS,
  PROGRAM_TIER_VALUES,
  PROGRAM_TIER_HEADER,
  isValidProgramTier,
};

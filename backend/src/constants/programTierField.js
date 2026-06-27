const { PROGRAM_TIER_VALUES, PROGRAM_TIERS } = require("./programTier");

const programTierField = {
  programTier: {
    type: String,
    enum: PROGRAM_TIER_VALUES,
    default: PROGRAM_TIERS.UNDERGRADUATE,
    required: true,
    index: true,
  },
};

module.exports = { programTierField };

export const PROGRAM_TIERS = {
  UNDERGRADUATE: "undergraduate",
  POSTGRADUATE: "postgraduate",
};

export const PROGRAM_TIER_OPTIONS = [
  {
    value: PROGRAM_TIERS.UNDERGRADUATE,
    label: "Undergraduate",
    description: "Bachelor-level research, thesis, and ethics workflows",
    icon: "🎓",
    accent: "#0ea5e9",
  },
  {
    value: PROGRAM_TIERS.POSTGRADUATE,
    label: "Postgraduate",
    description: "Master, PGD, and advanced research management",
    icon: "📚",
    accent: "#0284c7",
  },
];

export const PROGRAM_TIER_STORAGE_KEY = "just_rms_program_tier";
export const PROGRAM_TIER_HEADER = "X-Program-Tier";

export function programTierLabel(tier) {
  return PROGRAM_TIER_OPTIONS.find((o) => o.value === tier)?.label || tier || "—";
}

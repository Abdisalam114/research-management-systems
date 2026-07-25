export const PROGRAM_TIERS = {
  UNDERGRADUATE: "undergraduate",
  POSTGRADUATE: "postgraduate",
};

/** Roles that see UG + PG together (one account each, system-wide). */
export const CROSS_TIER_ROLES = [
  "research_director",
  "faculty_coordinator",
  "finance_officer",
  "leadership",
];

export function isCrossTierRole(role) {
  return CROSS_TIER_ROLES.includes(role);
}

export const PROGRAM_TIER_OPTIONS = [
  {
    value: PROGRAM_TIERS.UNDERGRADUATE,
    label: "Undergraduate",
    shortLabel: "UG",
    description: "Bachelor-level research, thesis, and ethics workflows",
    icon: "🎓",
    accent: "#0ea5e9",
  },
  {
    value: PROGRAM_TIERS.POSTGRADUATE,
    label: "Postgraduate",
    shortLabel: "PG",
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

export function programTierShortLabel(tier) {
  const opt = PROGRAM_TIER_OPTIONS.find((o) => o.value === tier);
  if (opt) return opt.shortLabel;
  return tier || "—";
}

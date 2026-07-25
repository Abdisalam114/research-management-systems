import { programTierLabel, PROGRAM_TIERS } from "../constants/programTier";

const ACCENTS = {
  [PROGRAM_TIERS.UNDERGRADUATE]: "#0ea5e9",
  [PROGRAM_TIERS.POSTGRADUATE]: "#0284c7",
};

/** Small UG / PG badge for project & proposal cards. */
export function ProgramTierBadge({ tier, label, compact = false }) {
  if (!tier && !label) return null;
  const text =
    label ||
    (tier === PROGRAM_TIERS.POSTGRADUATE
      ? compact
        ? "PG"
        : "Postgraduate (PG)"
      : tier === PROGRAM_TIERS.UNDERGRADUATE
        ? compact
          ? "UG"
          : "Undergraduate (UG)"
        : programTierLabel(tier));
  const accent = ACCENTS[tier] || "#38bdf8";
  return (
    <span
      style={{
        display: "inline-block",
        marginRight: 8,
        padding: compact ? "1px 7px" : "2px 8px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.02,
        background: `${accent}22`,
        color: accent,
        border: `1px solid ${accent}55`,
      }}
      title={programTierLabel(tier) || label || ""}
    >
      {text}
    </span>
  );
}

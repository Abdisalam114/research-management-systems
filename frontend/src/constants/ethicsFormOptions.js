export const SUBJECT_OPTS = [
  { value: "human", label: "Human" },
  { value: "animal", label: "Animal" },
  { value: "records", label: "Records / data" },
  { value: "others", label: "Others" },
];

/** Ethics project level — only UG/Bachelor and PG/Master. */
export const PROJECT_LEVEL_OPTS = [
  {
    value: "undergraduate",
    short: "UG",
    label: "UG / Bachelor",
    description: "Undergraduate bachelor-level research",
    icon: "🎓",
  },
  {
    value: "master",
    short: "PG",
    label: "PG / Master",
    description: "Postgraduate master-level research",
    icon: "📚",
  },
];

export function projectLevelLabel(value) {
  if (!value) return "—";
  if (value === "pgd") return "PG / Master"; // legacy PGD → show as PG/Master
  const hit = PROJECT_LEVEL_OPTS.find((o) => o.value === value);
  return hit?.label || value;
}

/** Normalize legacy PGD to master for the form UI. */
export function normalizeProjectLevel(value) {
  if (value === "pgd") return "master";
  if (value === "undergraduate" || value === "master") return value;
  return value || "";
}

export const INSTRUMENT_OPTS = [
  { value: "interview", label: "Interviews" },
  { value: "experimental", label: "Experimental test / clinical procedure" },
  { value: "focus_group", label: "Focus group" },
  { value: "record_review", label: "Record review" },
  { value: "observation", label: "Observation" },
  { value: "survey", label: "Survey / Questionnaire" },
  { value: "others", label: "Others" },
];

export const CONSENT_ITEMS = [
  "type_of_study",
  "interventions",
  "time_of_study",
  "subject_role",
  "risks",
  "benefit",
  "compensation",
  "cost_reimbursement",
  "right_to_refuse",
  "confidentiality_privacy",
  "researcher_contacts",
];

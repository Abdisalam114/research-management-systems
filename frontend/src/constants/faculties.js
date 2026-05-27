export const FACULTIES = [
  { value: "Computer & IT", icon: "💻" },
  { value: "Engineering", icon: "⚙️" },
  { value: "Economics & Management", icon: "📈" },
  { value: "Medicine & Health Sciences", icon: "🏥" },
  { value: "Education", icon: "📚" },
  { value: "Veterinary & Agriculture Sciences", icon: "🌾" },
];

export const FACULTY_VALUES = FACULTIES.map((f) => f.value);

const FACULTY_KEYWORDS = {
  "Computer & IT": [
    "computer", "information technology", "info tech", "software", "data science",
    "informatics", "cybersec", "network", "ai", "artificial intelligence", "ict",
    "computing",
  ],
  "Engineering": [
    "engineer", "civil", "mechanical", "electrical", "electronics", "telecom",
    "architecture", "construction", "petroleum", "industrial",
  ],
  "Economics & Management": [
    "econom", "business", "management", "accounting", "finance", "marketing",
    "banking", "administration", "mba", "commerce", "entrepreneur",
  ],
  "Medicine & Health Sciences": [
    "medic", "health", "nurs", "pharm", "dent", "midwif", "biomed", "clinical",
    "public health", "lab tech", "anatomy", "physiology", "epidemiol",
  ],
  "Education": [
    "educat", "teach", "pedagog", "curriculum", "english", "arabic", "literature",
    "history", "geography", "language", "linguist", "sharia", "islamic", "religion",
    "theolog", "law", "legal", "sociolog", "psycholog", "political", "social",
    "anthropol", "philosoph", "journal", "media", "communication", "art", "design",
    "music", "human", "culture",
  ],
  "Veterinary & Agriculture Sciences": [
    "veterin", "agric", "animal", "plant", "food sci", "environment", "soil",
    "crop", "fish", "horticulture", "forestry",
  ],
};

// Fallback faculty when no keyword matches — guarantees every department
// is bucketed into one of the 6 faculties (no "unknown" / "other").
export const DEFAULT_FACULTY = "Education";

export function matchFacultyByName(name) {
  if (!name) return DEFAULT_FACULTY;
  const lc = String(name).toLowerCase();
  for (const f of FACULTIES) {
    const kws = FACULTY_KEYWORDS[f.value];
    if (kws.some((kw) => lc.includes(kw))) return f.value;
  }
  return DEFAULT_FACULTY;
}

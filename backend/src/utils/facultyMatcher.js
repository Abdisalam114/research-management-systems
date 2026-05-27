const FACULTIES = [
  "Computer & IT",
  "Engineering",
  "Economics & Management",
  "Medicine & Health Sciences",
  "Education",
  "Veterinary & Agriculture Sciences",
];

const FACULTY_KEYWORDS = {
  "Computer & IT": [
    "computer",
    "information technology",
    "info tech",
    "software",
    "data science",
    "informatics",
    "cybersec",
    "network",
    "ai",
    "artificial intelligence",
    "ict",
    "it ",
    " it",
    "computing",
  ],
  "Engineering": [
    "engineer",
    "civil",
    "mechanical",
    "electrical",
    "electronics",
    "telecom",
    "architecture",
    "construction",
    "petroleum",
    "industrial",
  ],
  "Economics & Management": [
    "econom",
    "business",
    "management",
    "accounting",
    "finance",
    "marketing",
    "banking",
    "administration",
    "mba",
    "commerce",
    "entrepreneur",
  ],
  "Medicine & Health Sciences": [
    "medic",
    "health",
    "nurs",
    "pharm",
    "dent",
    "midwif",
    "biomed",
    "clinical",
    "public health",
    "lab tech",
    "anatomy",
    "physiology",
    "epidemiol",
  ],
  "Education": [
    "educat",
    "teach",
    "pedagog",
    "curriculum",
    "english",
    "arabic",
    "literature",
    "history",
    "geography",
    "language",
    "linguist",
    "sharia",
    "islamic",
    "religion",
    "theolog",
    "law",
    "legal",
    "sociolog",
    "psycholog",
    "political",
    "social",
    "anthropol",
    "philosoph",
    "journal",
    "media",
    "communication",
    "art",
    "design",
    "music",
    "human",
    "culture",
  ],
  "Veterinary & Agriculture Sciences": [
    "veterin",
    "agric",
    "animal",
    "plant",
    "food sci",
    "environment",
    "soil",
    "crop",
    "fish",
    "horticulture",
    "forestry",
  ],
};

// Fallback faculty so every department is normalized into one of the 6 faculties
// (no "unknown" / "other" bucket).
const DEFAULT_FACULTY = "Education";

function matchFacultyByName(name) {
  if (!name) return DEFAULT_FACULTY;
  const lc = String(name).toLowerCase();
  for (const faculty of FACULTIES) {
    const kws = FACULTY_KEYWORDS[faculty];
    if (kws.some((kw) => lc.includes(kw))) return faculty;
  }
  return DEFAULT_FACULTY;
}

module.exports = { FACULTIES, DEFAULT_FACULTY, matchFacultyByName };

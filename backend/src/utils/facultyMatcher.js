const FACULTIES = [
  "Computer & IT",
  "Engineering",
  "Economics & Management",
  "Medicine & Health Sciences",
  "Education",
  "Veterinary & Agriculture Sciences",
];

/** Map UI / seed faculty labels onto the 6 canonical faculties. */
const FACULTY_ALIASES = Object.freeze({
  "faculty of computing": "Computer & IT",
  "computer & it": "Computer & IT",
  "computing": "Computer & IT",
  "faculty of engineering": "Engineering",
  "engineering": "Engineering",
  "faculty of business": "Economics & Management",
  "faculty of economics": "Economics & Management",
  "economics & management": "Economics & Management",
  "faculty of medicine & health sciences": "Medicine & Health Sciences",
  "medicine & health sciences": "Medicine & Health Sciences",
  "faculty of science": "Veterinary & Agriculture Sciences",
  "faculty of education": "Education",
  "faculty of social sciences": "Education",
  "veterinary & agriculture sciences": "Veterinary & Agriculture Sciences",
});

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
  Engineering: [
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
  Education: [
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
const DEFAULT_FACULTY = "Education";

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Short keywords ("ai", "art", "it") must not substring-match unrelated names
 * ("Training", "Earth Sciences"). Spaced keywords keep includes() semantics.
 */
function keywordMatchesName(lcName, kw) {
  const raw = String(kw || "").toLowerCase();
  if (!raw) return false;
  if (raw !== raw.trim()) return lcName.includes(raw);
  if (raw.length <= 3) {
    // Whole word or word-prefix: "art"→"arts", "ai"→"AI"; not "ai"∈"Training"
    return new RegExp(`(?:^|[^a-z0-9])${escapeRegex(raw)}`).test(lcName);
  }
  return lcName.includes(raw);
}

function matchFacultyByName(name) {
  if (!name) return DEFAULT_FACULTY;
  const lc = String(name).toLowerCase().trim();
  if (FACULTY_ALIASES[lc]) return FACULTY_ALIASES[lc];
  for (const faculty of FACULTIES) {
    if (lc === faculty.toLowerCase()) return faculty;
  }
  for (const faculty of FACULTIES) {
    const kws = FACULTY_KEYWORDS[faculty];
    if (kws.some((kw) => keywordMatchesName(lc, kw))) return faculty;
  }
  return DEFAULT_FACULTY;
}

/** Coordinator dept may be faculty-level ("Faculty of Computing") while researcher dept is a department name. */
function coordinatorMatchesResearcherDept(coordinatorDept, researcherDept) {
  const cd = String(coordinatorDept || "").trim();
  const rd = String(researcherDept || "").trim();
  if (!cd) return true;
  if (!rd) return false;
  if (cd.toLowerCase() === rd.toLowerCase()) return true;
  return matchFacultyByName(cd) === matchFacultyByName(rd);
}

function resolveCoordinatorDepartment(req) {
  return String(req?.user?.department || req?.currentUser?.department || "").trim();
}

/**
 * Expand a coordinator faculty label into concrete department names used on proposals/projects/users.
 * Returns null when coordinator has no department (should not happen for active coordinators).
 */
async function departmentNamesForCoordinatorScope(coordinatorDept, DepartmentModel) {
  const cd = String(coordinatorDept || "").trim();
  if (!cd) return null;
  const names = new Set([cd]);
  try {
    const depts = await DepartmentModel.find({}).select("name faculty").lean();
    for (const d of depts) {
      const name = String(d.name || "").trim();
      const faculty = String(d.faculty || "").trim();
      if (name && (coordinatorMatchesResearcherDept(cd, name) || coordinatorMatchesResearcherDept(cd, faculty))) {
        names.add(name);
      }
      if (faculty && coordinatorMatchesResearcherDept(cd, faculty)) {
        names.add(faculty);
      }
    }
  } catch {
    /* Department model optional at call site */
  }
  return [...names];
}

function mongoDepartmentInFaculty(departmentNames) {
  if (!departmentNames || !departmentNames.length) return null;
  return { department: { $in: departmentNames } };
}

/** True when any candidate department/faculty belongs to the coordinator's faculty. */
function recordInCoordinatorFaculty(coordinatorDept, ...candidates) {
  const cd = String(coordinatorDept || "").trim();
  if (!cd) return true;
  return candidates.some((c) => {
    const v = String(c || "").trim();
    return v && coordinatorMatchesResearcherDept(cd, v);
  });
}

module.exports = {
  FACULTIES,
  DEFAULT_FACULTY,
  FACULTY_ALIASES,
  matchFacultyByName,
  coordinatorMatchesResearcherDept,
  resolveCoordinatorDepartment,
  departmentNamesForCoordinatorScope,
  mongoDepartmentInFaculty,
  recordInCoordinatorFaculty,
};

/**
 * Institutional accounts: one shared Director / Coordinator / Finance / Leadership
 * for the whole system (UG + PG). Researchers remain portal-scoped (UG or PG).
 */
const { ROLES, USER_STATUSES } = require("../models/User");
const { PROGRAM_TIERS } = require("../constants/programTier");

const DIRECTOR_USER = {
  fullName: "Dr. Catherine Morrison",
  email: process.env.SEED_DIRECTOR_EMAIL || "director@rms.edu",
  password: process.env.SEED_DIRECTOR_PASSWORD || "Director2024!",
  role: ROLES.RESEARCH_DIRECTOR,
  department: "Research Office",
  rank: "Director",
  status: USER_STATUSES.ACTIVE,
  isProtected: true,
  programTier: PROGRAM_TIERS.UNDERGRADUATE,
};

/** One of each — shared across Undergraduate and Postgraduate. */
const SHARED_STAFF_USERS = [
  {
    fullName: "Dr. Emma Richardson",
    email: "coordinator@rms.edu",
    password: process.env.SEED_COORDINATOR_PASSWORD || "Coordinator2024!",
    role: ROLES.FACULTY_COORDINATOR,
    department: "Faculty of Computing",
    rank: "Coordinator",
    status: USER_STATUSES.ACTIVE,
    programTier: PROGRAM_TIERS.UNDERGRADUATE,
  },
  {
    fullName: "Michael Brooks",
    email: "finance@rms.edu",
    password: process.env.SEED_FINANCE_PASSWORD || "Finance2024!",
    role: ROLES.FINANCE_OFFICER,
    department: "Finance Office",
    rank: "Officer",
    status: USER_STATUSES.ACTIVE,
    programTier: PROGRAM_TIERS.UNDERGRADUATE,
  },
  {
    fullName: "Prof. Ibrahim Warsame",
    email: "leadership@rms.edu",
    password: process.env.SEED_LEADERSHIP_PASSWORD || "Leadership2024!",
    role: ROLES.LEADERSHIP,
    department: "University Leadership",
    rank: "Vice Chancellor",
    status: USER_STATUSES.ACTIVE,
    programTier: PROGRAM_TIERS.UNDERGRADUATE,
  },
];

/** Portal-scoped researchers only. */
const PORTAL_USER_SPECS = {
  [PROGRAM_TIERS.UNDERGRADUATE]: [
    {
      fullName: "Dr. Sarah Chen",
      email: "asha@rms.edu",
      password: process.env.SEED_RESEARCHER_PASSWORD || "Researcher2024!",
      role: ROLES.RESEARCHER,
      department: "Computer Science",
      rank: "Lecturer",
      status: USER_STATUSES.ACTIVE,
    },
  ],
  [PROGRAM_TIERS.POSTGRADUATE]: [
    {
      fullName: "Dr. James Okonkwo",
      email: "mahad@rms.edu",
      password: process.env.SEED_RESEARCHER_PASSWORD || "Researcher2024!",
      role: ROLES.RESEARCHER,
      department: "Engineering",
      rank: "Assistant Professor",
      status: USER_STATUSES.ACTIVE,
    },
  ],
};

function buildInstitutionalUsers() {
  const users = [DIRECTOR_USER, ...SHARED_STAFF_USERS];
  for (const tier of Object.values(PROGRAM_TIERS)) {
    for (const spec of PORTAL_USER_SPECS[tier] || []) {
      users.push({ ...spec, programTier: tier });
    }
  }
  return users;
}

const INSTITUTIONAL_USERS = buildInstitutionalUsers();

/** Institutional emails retired from the active seed roster (cleaned on seed). */
const RETIRED_SEED_EMAILS = [
  "sahra@rms.edu",
  "amina@rms.edu",
  "ethics@rms.edu",
  "ethics.pg@rms.edu",
  "reviewer@rms.edu",
  "reviewer.pg@rms.edu",
  "procurement@rms.edu",
  "procurement.pg@rms.edu",
  "hr@rms.edu",
  "hr.pg@rms.edu",
  "donor@rms.edu",
  "donor.pg@rms.edu",
  "coordinator.pg@rms.edu",
  "finance.pg@rms.edu",
  "leadership.pg@rms.edu",
];

const PORTAL_ORDER = [PROGRAM_TIERS.UNDERGRADUATE, PROGRAM_TIERS.POSTGRADUATE];

module.exports = {
  DIRECTOR_USER,
  SHARED_STAFF_USERS,
  PORTAL_USER_SPECS,
  PORTAL_ORDER,
  INSTITUTIONAL_USERS,
  RETIRED_SEED_EMAILS,
  PROGRAM_TIERS,
};

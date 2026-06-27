/**
 * Institutional user accounts per portal (Undergraduate / Postgraduate).
 * Run with: npm run seed
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

const PORTAL_USER_SPECS = {
  [PROGRAM_TIERS.UNDERGRADUATE]: [
    {
      fullName: "Dr. Emma Richardson",
      email: "coordinator@rms.edu",
      password: process.env.SEED_COORDINATOR_PASSWORD || "Coordinator2024!",
      role: ROLES.FACULTY_COORDINATOR,
      department: "Faculty of Computing",
      rank: "Coordinator",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Michael Brooks",
      email: "finance@rms.edu",
      password: process.env.SEED_FINANCE_PASSWORD || "Finance2024!",
      role: ROLES.FINANCE_OFFICER,
      department: "Finance Office",
      rank: "Officer",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Dr. Sarah Chen",
      email: "asha@rms.edu",
      password: process.env.SEED_RESEARCHER_PASSWORD || "Researcher2024!",
      role: ROLES.RESEARCHER,
      department: "Computer Science",
      rank: "Lecturer",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Dr. Priya Sharma",
      email: "sahra@rms.edu",
      password: process.env.SEED_RESEARCHER_PASSWORD || "Researcher2024!",
      role: ROLES.RESEARCHER,
      department: "Information Technology",
      rank: "Assistant Lecturer",
      status: USER_STATUSES.ACTIVE,
    },
  ],
  [PROGRAM_TIERS.POSTGRADUATE]: [
    {
      fullName: "Dr. Robert Clarke",
      email: "coordinator.pg@rms.edu",
      password: process.env.SEED_COORDINATOR_PASSWORD || "Coordinator2024!",
      role: ROLES.FACULTY_COORDINATOR,
      department: "Faculty of Graduate Studies",
      rank: "Coordinator",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Linda Martinez",
      email: "finance.pg@rms.edu",
      password: process.env.SEED_FINANCE_PASSWORD || "Finance2024!",
      role: ROLES.FINANCE_OFFICER,
      department: "Finance Office",
      rank: "Officer",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Dr. James Okonkwo",
      email: "mahad@rms.edu",
      password: process.env.SEED_RESEARCHER_PASSWORD || "Researcher2024!",
      role: ROLES.RESEARCHER,
      department: "Engineering",
      rank: "Assistant Professor",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Amina Yusuf",
      email: "amina@rms.edu",
      password: process.env.SEED_RESEARCHER_PASSWORD || "Researcher2024!",
      role: ROLES.RESEARCHER,
      department: "Public Health",
      rank: "Senior Lecturer",
      status: USER_STATUSES.ACTIVE,
    },
  ],
};

function buildInstitutionalUsers() {
  const users = [DIRECTOR_USER];
  for (const tier of Object.values(PROGRAM_TIERS)) {
    for (const spec of PORTAL_USER_SPECS[tier]) {
      users.push({ ...spec, programTier: tier });
    }
  }
  return users;
}

const INSTITUTIONAL_USERS = buildInstitutionalUsers();

const PORTAL_ORDER = [PROGRAM_TIERS.UNDERGRADUATE, PROGRAM_TIERS.POSTGRADUATE];

module.exports = {
  DIRECTOR_USER,
  PORTAL_USER_SPECS,
  PORTAL_ORDER,
  INSTITUTIONAL_USERS,
  PROGRAM_TIERS,
};

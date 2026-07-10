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
      fullName: "Dr. Hassan Ali",
      email: "ethics@rms.edu",
      password: process.env.SEED_ETHICS_PASSWORD || "Ethics2024!",
      role: ROLES.ETHICS_COMMITTEE,
      department: "Ethics Committee",
      rank: "Chair",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Samira Noor",
      email: "procurement@rms.edu",
      password: process.env.SEED_PROCUREMENT_PASSWORD || "Procurement2024!",
      role: ROLES.PROCUREMENT_OFFICER,
      department: "Procurement Office",
      rank: "Officer",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Dr. Omar Khaled",
      email: "reviewer@rms.edu",
      password: process.env.SEED_REVIEWER_PASSWORD || "Reviewer2024!",
      role: ROLES.PEER_REVIEWER,
      department: "Faculty of Science",
      rank: "Peer Reviewer",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Fatima Ahmed",
      email: "hr@rms.edu",
      password: process.env.SEED_HR_PASSWORD || "Hr2024!",
      role: ROLES.HR_OFFICER,
      department: "HR Office",
      rank: "Officer",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Prof. Ibrahim Warsame",
      email: "leadership@rms.edu",
      password: process.env.SEED_LEADERSHIP_PASSWORD || "Leadership2024!",
      role: ROLES.LEADERSHIP,
      department: "University Leadership",
      rank: "Vice Chancellor",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "UNESCO Program Liaison",
      email: "donor@rms.edu",
      password: process.env.SEED_DONOR_PASSWORD || "Donor2024!",
      role: ROLES.DONOR_AGENCY,
      department: "External Donor Agency",
      rank: "Program Officer",
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
      fullName: "Dr. Amina Farah",
      email: "ethics.pg@rms.edu",
      password: process.env.SEED_ETHICS_PASSWORD || "Ethics2024!",
      role: ROLES.ETHICS_COMMITTEE,
      department: "Ethics Committee",
      rank: "Chair",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Omar Said",
      email: "procurement.pg@rms.edu",
      password: process.env.SEED_PROCUREMENT_PASSWORD || "Procurement2024!",
      role: ROLES.PROCUREMENT_OFFICER,
      department: "Procurement Office",
      rank: "Officer",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Dr. Layla Hassan",
      email: "reviewer.pg@rms.edu",
      password: process.env.SEED_REVIEWER_PASSWORD || "Reviewer2024!",
      role: ROLES.PEER_REVIEWER,
      department: "Graduate Research",
      rank: "Peer Reviewer",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Yusuf Ali",
      email: "hr.pg@rms.edu",
      password: process.env.SEED_HR_PASSWORD || "Hr2024!",
      role: ROLES.HR_OFFICER,
      department: "HR Office",
      rank: "Officer",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "Prof. Halima Nur",
      email: "leadership.pg@rms.edu",
      password: process.env.SEED_LEADERSHIP_PASSWORD || "Leadership2024!",
      role: ROLES.LEADERSHIP,
      department: "University Leadership",
      rank: "Deputy Vice Chancellor",
      status: USER_STATUSES.ACTIVE,
    },
    {
      fullName: "WHO EMRO Liaison",
      email: "donor.pg@rms.edu",
      password: process.env.SEED_DONOR_PASSWORD || "Donor2024!",
      role: ROLES.DONOR_AGENCY,
      department: "External Donor Agency",
      rank: "Grant Monitor",
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

/** Former seed accounts removed from institutional roster (cleaned on seed). */
const REMOVED_INSTITUTIONAL_EMAILS = ["sahra@rms.edu", "amina@rms.edu"];

const PORTAL_ORDER = [PROGRAM_TIERS.UNDERGRADUATE, PROGRAM_TIERS.POSTGRADUATE];

module.exports = {
  DIRECTOR_USER,
  PORTAL_USER_SPECS,
  PORTAL_ORDER,
  INSTITUTIONAL_USERS,
  REMOVED_INSTITUTIONAL_EMAILS,
  PROGRAM_TIERS,
};

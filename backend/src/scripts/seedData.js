/**
 * Institutional seed data — edit users ONLY in this file.
 * Run everything with: npm run seed
 */
const { ROLES, USER_STATUSES } = require("../models/User");

const INSTITUTIONAL_USERS = [
  {
    fullName: "Research Director",
    email: process.env.SEED_DIRECTOR_EMAIL || "director@rms.edu",
    password: process.env.SEED_DIRECTOR_PASSWORD || "Director2024!",
    role: ROLES.RESEARCH_DIRECTOR,
    department: "Research Office",
    rank: "Director",
    status: USER_STATUSES.ACTIVE,
    isProtected: true,
  },
  {
    fullName: "Faculty Research Coordinator",
    email: "coordinator@rms.edu",
    password: process.env.SEED_COORDINATOR_PASSWORD || "Coordinator2024!",
    role: ROLES.FACULTY_COORDINATOR,
    department: "Faculty of Computing",
    rank: "Coordinator",
    status: USER_STATUSES.ACTIVE,
  },
  {
    fullName: "Finance Officer",
    email: "finance@rms.edu",
    password: process.env.SEED_FINANCE_PASSWORD || "Finance2024!",
    role: ROLES.FINANCE_OFFICER,
    department: "Finance Office",
    rank: "Officer",
    status: USER_STATUSES.ACTIVE,
  },
  {
    fullName: "Asha Mohamed",
    email: "asha@rms.edu",
    password: process.env.SEED_RESEARCHER_PASSWORD || "Researcher2024!",
    role: ROLES.RESEARCHER,
    department: "Computer Science",
    rank: "Lecturer",
    status: USER_STATUSES.ACTIVE,
  },
  {
    fullName: "Mahad Ali",
    email: "mahad@rms.edu",
    password: process.env.SEED_RESEARCHER_PASSWORD || "Researcher2024!",
    role: ROLES.RESEARCHER,
    department: "Engineering",
    rank: "Assistant Professor",
    status: USER_STATUSES.ACTIVE,
  },
];

module.exports = { INSTITUTIONAL_USERS };

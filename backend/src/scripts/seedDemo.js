const dotenv = require("dotenv");
dotenv.config();

const { connectDB } = require("../config/db");
const { User, ROLES, USER_STATUSES } = require("../models/User");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { Project } = require("../models/Project");
const path = require("path");
const { writeSimplePdf } = require("../utils/pdf");

async function upsertUser({ fullName, email, password, role, department, rank, status }) {
  const existing = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (existing) {
    existing.fullName = fullName;
    existing.role = role;
    existing.department = department;
    existing.rank = rank;
    existing.status = status;
    if (password) existing.password = password;
    await existing.save();
    return existing;
  }

  return User.create({ fullName, email, password, role, department, rank, status });
}

async function run() {
  await connectDB(process.env.MONGO_URI);

  const director = await upsertUser({
    fullName: "Research Director",
    email: "director@just.edu",
    password: process.env.SEED_DIRECTOR_PASSWORD || "Director123!",
    role: ROLES.RESEARCH_DIRECTOR,
    department: "Research Office",
    rank: "Director",
    status: USER_STATUSES.ACTIVE,
  });

  await upsertUser({
    fullName: "Faculty Research Coordinator",
    email: "coordinator@just.edu",
    password: "Coordinator123!",
    role: ROLES.FACULTY_COORDINATOR,
    department: "Faculty of Computing",
    rank: "Coordinator",
    status: USER_STATUSES.ACTIVE,
  });

  await upsertUser({
    fullName: "Finance Officer",
    email: "finance@just.edu",
    password: "Finance123!",
    role: ROLES.FINANCE_OFFICER,
    department: "Finance Office",
    rank: "Officer",
    status: USER_STATUSES.ACTIVE,
  });

  const r1 = await upsertUser({
    fullName: "Asha Researcher",
    email: "asha@just.edu",
    password: "Passw0rd!",
    role: ROLES.RESEARCHER,
    department: "Computer Science",
    rank: "Lecturer",
    status: USER_STATUSES.ACTIVE,
  });

  const r2 = await upsertUser({
    fullName: "Mahad Researcher",
    email: "mahad@just.edu",
    password: "Passw0rd!",
    role: ROLES.RESEARCHER,
    department: "Engineering",
    rank: "Assistant Prof",
    status: USER_STATUSES.ACTIVE,
  });

  const seedTitles = [
    "AI-assisted Early Disease Screening in Low-Resource Clinics",
    "Renewable Microgrid Optimization for Campus Resilience",
    "Community Water Quality Monitoring Using Low-Cost Sensors",
  ];

  // Cleanup any previously seeded "DEMO:" records + any exact-title seeded records
  const old = await Proposal.find({
    $or: [{ title: { $in: seedTitles } }, { title: { $regex: /^DEMO:/ } }],
  }).select("_id");
  const oldIds = old.map((p) => p._id);
  if (oldIds.length) {
    await Project.deleteMany({ $or: [{ proposalId: { $in: oldIds } }, { title: { $regex: /^DEMO:/ } }] });
    await Proposal.deleteMany({ _id: { $in: oldIds } });
  } else {
    // still remove any old demo projects by title
    await Project.deleteMany({ title: { $regex: /^DEMO:/ } });
  }

  const seededProposals = await Proposal.insertMany([
    {
      title: seedTitles[0],
      abstract:
        "A pilot study on lightweight machine learning screening tools suitable for low-resource clinical workflows at JUST partner clinics.",
      department: r1.department,
      researchArea: "Artificial Intelligence",
      document: null,
      version: 1,
      researcherId: r1._id,
      status: PROPOSAL_STATUSES.SUBMITTED,
      submittedAt: new Date(),
      reviewerComments: [],
    },
    {
      title: seedTitles[1],
      abstract:
        "Optimization of hybrid solar-diesel microgrids to improve reliability, reduce operating costs, and support critical facilities on campus.",
      department: r2.department,
      researchArea: "Energy Systems",
      document: null,
      version: 1,
      researcherId: r2._id,
      status: PROPOSAL_STATUSES.UNDER_REVIEW,
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      reviewerComments: [{ role: "faculty_coordinator", comment: "Promising scope; please clarify data sources and evaluation metrics." }],
    },
    {
      title: seedTitles[2],
      abstract:
        "A community-driven monitoring framework using low-cost sensors and open reporting to improve water safety and public health outcomes.",
      department: "Environmental Science",
      researchArea: "Public Health",
      document: null,
      version: 1,
      researcherId: r1._id,
      status: PROPOSAL_STATUSES.APPROVED,
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      reviewerComments: [{ role: "research_director", comment: "Approved for pilot implementation." }],
    },
  ]);

  // Generate realistic sample PDFs (local, not copyrighted) and attach to proposals
  const uploadsDir = path.join(process.cwd(), "uploads");
  const pdf1 = `seeded-paper-${Date.now()}-screening.pdf`;
  const pdf2 = `seeded-paper-${Date.now()}-microgrid.pdf`;
  const pdf3 = `seeded-paper-${Date.now()}-water.pdf`;

  await writeSimplePdf({
    filePath: path.join(uploadsDir, pdf1),
    title: seedTitles[0],
    author: r1.fullName,
    bodyLines: [
      "Abstract:",
      "This paper presents an MVP-level research proposal document for JUST’s Research Management System.",
      "We propose a lightweight ML-assisted screening workflow suitable for low-resource clinics, focusing on practicality and evaluation metrics.",
      "",
      "Keywords: screening, machine learning, clinical workflow, JUST",
    ],
  });
  await writeSimplePdf({
    filePath: path.join(uploadsDir, pdf2),
    title: seedTitles[1],
    author: r2.fullName,
    bodyLines: [
      "Abstract:",
      "This document outlines an optimization approach for hybrid solar-diesel microgrids to improve reliability and cost efficiency for campus operations.",
      "",
      "Keywords: microgrid, optimization, resilience, energy systems, JUST",
    ],
  });
  await writeSimplePdf({
    filePath: path.join(uploadsDir, pdf3),
    title: seedTitles[2],
    author: r1.fullName,
    bodyLines: [
      "Abstract:",
      "This document presents a community-driven monitoring framework using low-cost sensors and open reporting for improving water safety outcomes.",
      "",
      "Keywords: water quality, sensors, community monitoring, public health, JUST",
    ],
  });

  const [p1, p2, p3] = seededProposals;
  await Proposal.updateOne({ _id: p1._id }, { $set: { document: `/uploads/${pdf1}` } });
  await Proposal.updateOne({ _id: p2._id }, { $set: { document: `/uploads/${pdf2}` } });
  await Proposal.updateOne({ _id: p3._id }, { $set: { document: `/uploads/${pdf3}` } });

  // Create linked project for the approved proposal (mirrors the auto-create rule)
  const approved = seededProposals.find((p) => p.status === PROPOSAL_STATUSES.APPROVED);
  if (approved) {
    await Project.create({
      proposalId: approved._id,
      title: approved.title,
      researcherId: approved.researcherId,
      teamMembers: ["Co-Researcher 1", "Co-Researcher 2"],
      milestones: [
        { title: "Ethics clearance", dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14), completed: false },
        { title: "Pilot data collection", dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45), completed: false },
      ],
      status: "active",
      progressReports: [
        { note: "Project initialized from approved proposal.", progressPercent: 5, createdBy: director._id },
      ],
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seeded demo users, proposals, and projects.");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


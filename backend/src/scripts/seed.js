/**
 * Single institutional seed entry point.
 * All users are defined in seedData.js only.
 *
 * Usage: npm run seed
 */
const dotenv = require("dotenv");
dotenv.config();

const path = require("path");
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { User } = require("../models/User");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Budget, BUDGET_ITEM_STATUSES, BUDGET_ITEM_TYPES } = require("../models/Budget");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { ResearchGroup, GROUP_MEMBER_ROLES } = require("../models/ResearchGroup");
const { RepositoryItem, REPOSITORY_ACCESS } = require("../models/RepositoryItem");
const { Notification } = require("../models/Notification");
const { writeSimplePdf } = require("../utils/pdf");
const { INSTITUTIONAL_USERS } = require("./seedData");

async function upsertUser(spec) {
  const email = String(spec.email).toLowerCase().trim();
  const existing = await User.findOne({ email }).select("+password isProtected");
  if (existing) {
    existing.fullName = spec.fullName;
    existing.role = spec.role;
    existing.department = spec.department;
    existing.rank = spec.rank;
    existing.status = spec.status;
    if (spec.isProtected) existing.isProtected = true;
    if (spec.password) existing.password = spec.password;
    await existing.save();
    return existing;
  }
  return User.create({
    fullName: spec.fullName,
    email,
    password: spec.password,
    role: spec.role,
    department: spec.department,
    rank: spec.rank,
    status: spec.status,
    isProtected: Boolean(spec.isProtected),
  });
}

async function seedUsers() {
  const users = {};
  for (const spec of INSTITUTIONAL_USERS) {
    const u = await upsertUser(spec);
    users[spec.email.toLowerCase()] = u;
  }

  // Legacy demo accounts → rename to Director (no more "Seed Admin")
  const legacyAdmin = await User.findOne({ email: "admin@rms.edu" }).select("+password");
  if (legacyAdmin) {
    legacyAdmin.fullName = "Research Director";
    legacyAdmin.role = INSTITUTIONAL_USERS[0].role;
    legacyAdmin.status = INSTITUTIONAL_USERS[0].status;
    legacyAdmin.isProtected = true;
    await legacyAdmin.save();
    users["admin@rms.edu"] = legacyAdmin;
  }

  return users;
}

async function seedProposalsAndProjects(director, r1, r2) {
  const seedTitles = [
    "AI-assisted Early Disease Screening in Low-Resource Clinics",
    "Renewable Microgrid Optimization for Campus Resilience",
    "Community Water Quality Monitoring Using Low-Cost Sensors",
  ];

  const old = await Proposal.find({
    $or: [{ title: { $in: seedTitles } }, { title: { $regex: /^DEMO:|^SEED:/ } }],
  }).select("_id");
  const oldIds = old.map((p) => p._id);
  if (oldIds.length) {
    await Project.deleteMany({ $or: [{ proposalId: { $in: oldIds } }, { title: { $regex: /^DEMO:|^SEED:/ } }] });
    await Proposal.deleteMany({ _id: { $in: oldIds } });
  }

  const seededProposals = await Proposal.insertMany([
    {
      title: seedTitles[0],
      abstract:
        "A pilot study on lightweight machine learning screening tools suitable for low-resource clinical workflows at partner clinics.",
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
      submittedAt: new Date(Date.now() - 86400000),
      reviewerComments: [
        { role: "faculty_coordinator", comment: "Promising scope; please clarify data sources and evaluation metrics." },
      ],
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
      submittedAt: new Date(Date.now() - 172800000),
      reviewerComments: [{ role: "research_director", comment: "Approved for pilot implementation." }],
    },
  ]);

  const uploadsDir = path.join(process.cwd(), "uploads");
  const pdf1 = `seeded-paper-${Date.now()}-screening.pdf`;
  const pdf2 = `seeded-paper-${Date.now()}-microgrid.pdf`;
  const pdf3 = `seeded-paper-${Date.now()}-water.pdf`;

  await writeSimplePdf({
    filePath: path.join(uploadsDir, pdf1),
    title: seedTitles[0],
    author: r1.fullName,
    bodyLines: ["Institutional seed proposal document for Jamhuriya RMS."],
  });
  await writeSimplePdf({
    filePath: path.join(uploadsDir, pdf2),
    title: seedTitles[1],
    author: r2.fullName,
    bodyLines: ["Institutional seed proposal document for Jamhuriya RMS."],
  });
  await writeSimplePdf({
    filePath: path.join(uploadsDir, pdf3),
    title: seedTitles[2],
    author: r1.fullName,
    bodyLines: ["Institutional seed proposal document for Jamhuriya RMS."],
  });

  const [p1, p2, p3] = seededProposals;
  await Proposal.updateOne({ _id: p1._id }, { $set: { document: `/uploads/${pdf1}` } });
  await Proposal.updateOne({ _id: p2._id }, { $set: { document: `/uploads/${pdf2}` } });
  await Proposal.updateOne({ _id: p3._id }, { $set: { document: `/uploads/${pdf3}` } });

  const approved = seededProposals.find((p) => p.status === PROPOSAL_STATUSES.APPROVED);
  if (approved) {
    await Project.create({
      proposalId: approved._id,
      title: approved.title,
      researcherId: approved.researcherId,
      teamMembers: ["Co-Researcher 1", "Co-Researcher 2"],
      milestones: [
        { title: "Ethics clearance", dueDate: new Date(Date.now() + 1209600000), completed: false },
        { title: "Pilot data collection", dueDate: new Date(Date.now() + 3888000000), completed: false },
      ],
      status: "active",
      progressReports: [
        { note: "Project initialized from approved proposal.", progressPercent: 5, createdBy: director._id },
      ],
    });
  }
}

async function seedModules(director, researcher) {
  const oldGrantIds = await Grant.find({ title: { $regex: /^SEED:/ } }).distinct("_id");
  await Grant.deleteMany({ title: { $regex: /^SEED:/ } });
  await Publication.deleteMany({ title: { $regex: /^SEED:/ } });
  await Budget.deleteMany({
    $or: [
      { financeNotes: { $in: ["INSTITUTIONAL_SEED", "SEED_MODULE"] } },
      ...(oldGrantIds.length ? [{ grantId: { $in: oldGrantIds } }] : []),
    ],
  });
  await ResearchGroup.deleteMany({ name: { $regex: /^SEED:/ } });
  await RepositoryItem.deleteMany({ title: { $regex: /^SEED:/ } });

  const grant = await Grant.create({
    title: "SEED: Campus Innovation Grant",
    fundingSource: "Jamhuriya Research Fund",
    amountRequested: 25000,
    currency: "USD",
    researcherId: researcher._id,
    status: GRANT_STATUSES.SUBMITTED,
    submittedAt: new Date(),
  });

  await Budget.create({
    grantId: grant._id,
    ownerResearcherId: researcher._id,
    totalAllocated: 25000,
    currency: "USD",
    financeNotes: "INSTITUTIONAL_SEED",
    items: [
      {
        type: BUDGET_ITEM_TYPES.EXPENSE,
        description: "SEED: Lab consumables",
        amount: 1200,
        status: BUDGET_ITEM_STATUSES.PENDING,
        createdBy: researcher._id,
      },
    ],
  });

  await Publication.insertMany([
    {
      title: "SEED: ML Screening in Low-Resource Clinics",
      type: "journal_article",
      year: 2025,
      researcherId: researcher._id,
      status: PUBLICATION_STATUSES.SUBMITTED,
    },
    {
      title: "SEED: Microgrid Optimization Review",
      type: "conference_paper",
      year: 2024,
      researcherId: researcher._id,
      status: PUBLICATION_STATUSES.VALIDATED,
    },
  ]);

  await ResearchGroup.create({
    name: "SEED: AI & Health Research Group",
    description: "Institutional collaboration group",
    createdBy: researcher._id,
    members: [{ userId: researcher._id, role: GROUP_MEMBER_ROLES.LEAD }],
  });

  await RepositoryItem.create({
    type: "document",
    title: "SEED: Pilot Study Protocol",
    description: "Institutional repository sample",
    filePath: "/uploads/seed-placeholder.txt",
    fileSize: 0,
    access: REPOSITORY_ACCESS.INSTITUTION,
    uploadedBy: researcher._id,
  });

  await Notification.create({
    userId: director._id,
    type: "grant",
    title: "Grant submitted for director review",
    body: grant.title,
    link: "/grants",
  });
}

async function run() {
  await connectDB(process.env.MONGO_URI);

  console.log("=== Jamhuriya RMS institutional seed ===\n");
  console.log("1/3 Users (see seedData.js)...");
  const users = await seedUsers();

  const director = users["director@rms.edu"] || users["admin@rms.edu"];
  const r1 = users["asha@rms.edu"];
  const r2 = users["mahad@rms.edu"];

  if (!director || !r1 || !r2) {
    throw new Error("Missing director or researcher accounts after user seed.");
  }

  console.log("2/3 Proposals & projects...");
  await seedProposalsAndProjects(director, r1, r2);

  console.log("3/3 Grants, budgets, publications, groups, repository...");
  await seedModules(director, r1);

  console.log("\nDone. Director login:");
  console.log(`  Email: ${INSTITUTIONAL_USERS[0].email}`);
  console.log(`  Password: (see SEED_DIRECTOR_PASSWORD or seedData.js)`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } finally {
      process.exit();
    }
  });

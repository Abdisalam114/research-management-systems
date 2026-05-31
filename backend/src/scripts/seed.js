/**
 * Institutional seed — users in seedData.js; sample data tops up each module to 10 rows.
 * Usage: npm run seed
 */
const dotenv = require("dotenv");
dotenv.config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { User } = require("../models/User");
const { Proposal, PROPOSAL_STATUSES } = require("../models/Proposal");
const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Budget, BUDGET_ITEM_STATUSES, BUDGET_ITEM_TYPES } = require("../models/Budget");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { ResearchGroup, GROUP_MEMBER_ROLES, GROUP_KINDS } = require("../models/ResearchGroup");
const { ThesisGroup, THESIS_STATUSES } = require("../models/ThesisGroup");
const { RepositoryItem, REPOSITORY_ACCESS } = require("../models/RepositoryItem");
const { Notification, NOTIFICATION_TYPES } = require("../models/Notification");
const { Department } = require("../models/Department");
const { EthicsApplication, ETHICS_STATUSES } = require("../models/EthicsApplication");
const { Payment, PAYMENT_CATEGORIES, PAYMENT_STATUSES } = require("../models/Payment");
const { writeSimplePdf } = require("../utils/pdf");
const { INSTITUTIONAL_USERS } = require("./seedData");
const {
  TARGET,
  SAMPLE_PROPOSALS,
  SAMPLE_GRANTS,
  SAMPLE_PUBLICATIONS,
  SAMPLE_COLLAB_GROUPS,
  SAMPLE_THESIS,
  SAMPLE_DEPARTMENTS,
  SAMPLE_ETHICS,
  SAMPLE_REPOSITORY,
  SAMPLE_NOTIFICATIONS,
  LEGACY_TITLE_FIXES,
} = require("./seedSamples");

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

async function normalizeLegacySeedLabels() {
  for (const [from, to] of LEGACY_TITLE_FIXES.Publication) {
    await Publication.updateMany({ title: from }, { $set: { title: to } });
  }
  for (const [from, to] of LEGACY_TITLE_FIXES.Grant) {
    await Grant.updateMany({ title: from }, { $set: { title: to } });
  }
  for (const [from, to] of LEGACY_TITLE_FIXES.ResearchGroup) {
    await ResearchGroup.updateMany({ name: from }, { $set: { name: to } });
  }
  for (const [from, to] of LEGACY_TITLE_FIXES.RepositoryItem) {
    await RepositoryItem.updateMany({ title: from }, { $set: { title: to } });
  }

  const budgets = await Budget.find({ "items.description": /^SEED:/ });
  for (const b of budgets) {
    let changed = false;
    b.items.forEach((item) => {
      if (item.description?.startsWith("SEED:")) {
        item.description = item.description.replace(/^SEED:\s*/, "");
        changed = true;
      }
    });
    if (changed) await b.save();
  }
}

async function insertUniqueByTitle(Model, titleField, samples, buildDoc) {
  let inserted = 0;
  const count = await Model.countDocuments();
  const need = Math.max(0, TARGET - count);
  if (!need) return 0;

  for (const sample of samples) {
    if (inserted >= need) break;
    const title = sample[titleField] || sample.title || sample.name;
    const exists = await Model.exists({ [titleField]: title });
    if (exists) continue;
    await Model.create(buildDoc(sample, inserted));
    inserted += 1;
  }
  return inserted;
}

async function seedProposals(director, researchers) {
  const [r1, r2] = researchers;
  let inserted = 0;
  const count = await Proposal.countDocuments();
  const need = Math.max(0, TARGET - count);
  if (!need) return 0;

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  for (let i = 0; inserted < need && i < SAMPLE_PROPOSALS.length * 2; i += 1) {
    const sample = SAMPLE_PROPOSALS[i % SAMPLE_PROPOSALS.length];
    const exists = await Proposal.exists({ title: sample.title });
    if (exists) continue;

    const researcher = i % 2 === 0 ? r1 : r2;
    const status = Object.values(PROPOSAL_STATUSES).includes(sample.status)
      ? sample.status
      : PROPOSAL_STATUSES.DRAFT;

    const pdfName = `proposal-${Date.now()}-${inserted}.pdf`;
    await writeSimplePdf({
      filePath: path.join(uploadsDir, pdfName),
      title: sample.title,
      author: researcher.fullName,
      bodyLines: [sample.abstract, "", "Jamhuriya University — Research Management System sample document."],
    });

    await Proposal.create({
      title: sample.title,
      abstract: sample.abstract,
      department: sample.department || researcher.department,
      researchArea: sample.researchArea,
      document: `/uploads/${pdfName}`,
      version: 1,
      researcherId: researcher._id,
      status,
      submittedAt: status !== PROPOSAL_STATUSES.DRAFT ? new Date(Date.now() - inserted * 86400000) : null,
      reviewerComments:
        status === PROPOSAL_STATUSES.UNDER_REVIEW
          ? [{ role: "faculty_coordinator", comment: "Please clarify methodology and timeline.", at: new Date() }]
          : status === PROPOSAL_STATUSES.APPROVED
            ? [{ role: "research_director", comment: "Approved for implementation.", at: new Date() }]
            : [],
    });
    inserted += 1;
  }
  return inserted;
}

async function seedProjects(director, researchers) {
  let projectCount = await Project.countDocuments();
  const need = Math.max(0, TARGET - projectCount);
  if (!need) return 0;

  let created = 0;
  const approved = await Proposal.find({ status: PROPOSAL_STATUSES.APPROVED }).sort({ createdAt: -1 });

  for (const prop of approved) {
    if (created >= need) break;
    const exists = await Project.exists({ proposalId: prop._id });
    if (exists) continue;

    await Project.create({
      proposalId: prop._id,
      title: prop.title,
      researcherId: prop.researcherId,
      teamMembers: [
        { name: "Research Assistant", role: "member" },
        { name: "Field Coordinator", role: "member" },
      ],
      milestones: [
        { title: "Ethics clearance & instruments", dueDate: new Date(Date.now() + 1209600000), completed: false },
        { title: "Data collection complete", dueDate: new Date(Date.now() + 3888000000), completed: false },
        { title: "Final report & dissemination", dueDate: new Date(Date.now() + 6220800000), completed: false },
      ],
      status: PROJECT_STATUSES.ACTIVE,
      progressReports: [
        {
          note: "Project initiated from approved proposal. Ethics application in progress.",
          progressPercent: 10 + created * 5,
          createdBy: director._id,
        },
      ],
    });
    created += 1;
    projectCount += 1;
  }

  return created;
}

async function seedGrantsAndBudgets(researchers, financeOfficer) {
  const [r1] = researchers;
  const grantsAdded = await insertUniqueByTitle(Grant, "title", SAMPLE_GRANTS, (s) => ({
    title: s.title,
    fundingSource: s.fundingSource,
    amountRequested: s.amountRequested,
    currency: "USD",
    researcherId: r1._id,
    status: Object.values(GRANT_STATUSES).includes(s.status) ? s.status : GRANT_STATUSES.DRAFT,
    submittedAt: s.status !== GRANT_STATUSES.DRAFT ? new Date() : null,
    amountAwarded:
      s.status === GRANT_STATUSES.ACTIVE || s.status === GRANT_STATUSES.APPROVED ? s.amountRequested : 0,
  }));

  const budgetCount = await Budget.countDocuments();
  const budgetNeed = Math.max(0, TARGET - budgetCount);
  if (budgetNeed > 0) {
    const grants = await Grant.find().sort({ createdAt: -1 }).limit(TARGET);
    let added = 0;
    for (const grant of grants) {
      if (added >= budgetNeed) break;
      const has = await Budget.exists({ grantId: grant._id });
      if (has) continue;
      await Budget.create({
        grantId: grant._id,
        ownerResearcherId: grant.researcherId,
        totalAllocated: grant.amountRequested,
        currency: "USD",
        financeNotes: "",
        items: [
          {
            type: BUDGET_ITEM_TYPES.EXPENSE,
            description: "Laboratory consumables and field supplies",
            amount: Math.round(grant.amountRequested * 0.15),
            status: BUDGET_ITEM_STATUSES.PENDING,
            createdBy: grant.researcherId,
          },
          {
            type: BUDGET_ITEM_TYPES.EXPENSE,
            description: "Research assistant stipend (3 months)",
            amount: Math.round(grant.amountRequested * 0.2),
            status: BUDGET_ITEM_STATUSES.APPROVED,
            createdBy: grant.researcherId,
            approvedBy: financeOfficer?._id || grant.researcherId,
          },
        ],
      });
      added += 1;
    }
  }

  return grantsAdded;
}

async function seedPublications(researchers) {
  const [r1, r2] = researchers;
  return insertUniqueByTitle(Publication, "title", SAMPLE_PUBLICATIONS, (s, idx) => ({
    title: s.title,
    type: s.type,
    year: s.year,
    communityImpact: s.communityImpact || "",
    venue: s.venue || "",
    researcherId: (idx || 0) % 2 === 0 ? r1._id : r2._id,
    status: Object.values(PUBLICATION_STATUSES).includes(s.status) ? s.status : PUBLICATION_STATUSES.DRAFT,
  }));
}

async function seedCollaborationGroups(researchers) {
  const [r1] = researchers;
  const count = await ResearchGroup.countDocuments({ kind: GROUP_KINDS.COLLABORATION });
  const need = Math.max(0, TARGET - count);
  if (!need) return 0;

  let inserted = 0;
  for (const sample of SAMPLE_COLLAB_GROUPS) {
    if (inserted >= need) break;
    const exists = await ResearchGroup.exists({ name: sample.name });
    if (exists) continue;
    await ResearchGroup.create({
      name: sample.name,
      description: sample.description,
      kind: GROUP_KINDS.COLLABORATION,
      createdBy: r1._id,
      members: [{ userId: r1._id, role: GROUP_MEMBER_ROLES.LEAD }],
    });
    inserted += 1;
  }
  return inserted;
}

async function createThesisRecord({ sample, coordinator, supervisor, createdBy }) {
  const exists = await ThesisGroup.exists({ title: sample.title });
  if (exists) return false;

  const leadId = supervisor?._id || createdBy._id;
  const memberIds = new Set([String(leadId), String(createdBy._id)]);

  const researchGroup = await ResearchGroup.create({
    name: sample.title.length > 120 ? `${sample.title.slice(0, 117)}...` : sample.title,
    description: "Thesis supervision group (sample data).",
    kind: GROUP_KINDS.THESIS,
    createdBy: createdBy._id,
    members: Array.from(memberIds).map((id) => ({
      userId: id,
      role: String(id) === String(leadId) ? GROUP_MEMBER_ROLES.LEAD : GROUP_MEMBER_ROLES.MEMBER,
    })),
  });

  const meetingDate = new Date(Date.now() - 7 * 86400000);
  await ThesisGroup.create({
    title: sample.title,
    students: sample.students,
    researchGroupId: researchGroup._id,
    supervisorId: supervisor?._id || null,
    coordinatorId: coordinator?._id || null,
    department: sample.department,
    faculty: sample.faculty,
    facultyResearchArea: sample.facultyResearchArea,
    meetingSchedule: sample.meetingSchedule,
    status: Object.values(THESIS_STATUSES).includes(sample.status) ? sample.status : THESIS_STATUSES.PROPOSED,
    meetings: supervisor
      ? [
          {
            date: meetingDate,
            location: sample.meetingSchedule.split("—").pop()?.trim() || "Campus",
            agenda: "Progress review and next milestones",
            notes: "Supervisor reviewed draft chapter outline.",
            loggedBy: supervisor._id,
          },
        ]
      : [],
    createdBy: createdBy._id,
  });
  return true;
}

async function seedThesisGroups(coordinator, supervisor, director) {
  const count = await ThesisGroup.countDocuments();
  const need = Math.max(0, TARGET - count);
  if (!need) return 0;

  const createdBy = coordinator || director;
  let inserted = 0;
  for (const sample of SAMPLE_THESIS) {
    if (inserted >= need) break;
    const ok = await createThesisRecord({ sample, coordinator, supervisor, createdBy });
    if (ok) inserted += 1;
  }
  return inserted;
}

async function seedDepartments(director) {
  let inserted = 0;
  const count = await Department.countDocuments();
  const need = Math.max(0, TARGET - count);
  if (!need) return 0;

  for (const d of SAMPLE_DEPARTMENTS) {
    if (inserted >= need) break;
    const exists = await Department.exists({ $or: [{ name: d.name }, { code: d.code }] });
    if (exists) continue;
    await Department.create({
      name: d.name,
      code: d.code,
      faculty: d.faculty,
      createdBy: director._id,
    });
    inserted += 1;
  }
  return inserted;
}

async function seedEthics(researchers) {
  const [r1, r2] = researchers;
  const count = await EthicsApplication.countDocuments();
  const need = Math.max(0, TARGET - count);
  if (!need) return 0;

  const statuses = [ETHICS_STATUSES.DRAFT, ETHICS_STATUSES.SUBMITTED, ETHICS_STATUSES.APPROVED];
  let inserted = 0;
  for (let i = 0; inserted < need && i < SAMPLE_ETHICS.length; i += 1) {
    const projectTitle = SAMPLE_ETHICS[i];
    const exists = await EthicsApplication.exists({ projectTitle });
    if (exists) continue;
    const researcher = i % 2 === 0 ? r1 : r2;
    await EthicsApplication.create({
      researcherId: researcher._id,
      status: statuses[i % statuses.length],
      projectTitle,
      projectLevel: i % 2 === 0 ? "master" : "undergraduate",
      principal: {
        firstName: researcher.fullName.split(" ")[0],
        lastName: researcher.fullName.split(" ").slice(1).join(" "),
        email: researcher.email,
        department: researcher.department,
        faculty: "Computer & IT",
      },
      backgroundLiterature: "Prior studies indicate a clear need for ethical, community-engaged research in this topic area.",
      aimsObjectives: "To collect and analyse data while protecting participant welfare and confidentiality.",
      rationale: "Addresses a documented gap in local evidence for policy and practice.",
      design: "Mixed-methods design with surveys and structured interviews.",
      subjectTypes: ["human"],
      risk: { level: "minimal", description: "Minimal risk; standard confidentiality safeguards apply." },
    });
    inserted += 1;
  }
  return inserted;
}

async function ensureRepositoryPlaceholder() {
  const uploadsDir = path.join(process.cwd(), "uploads");
  const filePath = path.join(uploadsDir, "repository-sample-placeholder.txt");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "Jamhuriya RMS — sample repository file.\n", "utf8");
  }
  return "/uploads/repository-sample-placeholder.txt";
}

async function seedRepository(researchers) {
  const [r1] = researchers;
  const placeholder = await ensureRepositoryPlaceholder();
  return insertUniqueByTitle(RepositoryItem, "title", SAMPLE_REPOSITORY, (s) => ({
    type: s.type,
    title: s.title,
    description: s.description,
    filePath: placeholder,
    fileSize: 128,
    access: REPOSITORY_ACCESS.INSTITUTION,
    uploadedBy: r1._id,
  }));
}

async function seedNotifications(director, coordinator) {
  const count = await Notification.countDocuments({ userId: director._id });
  const need = Math.max(0, TARGET - count);
  if (!need) return 0;

  let inserted = 0;
  for (const n of SAMPLE_NOTIFICATIONS) {
    if (inserted >= need) break;
    const exists = await Notification.exists({ userId: director._id, title: n.title });
    if (exists) continue;
    await Notification.create({
      userId: director._id,
      type: Object.values(NOTIFICATION_TYPES).includes(n.type) ? n.type : NOTIFICATION_TYPES.SYSTEM,
      title: n.title,
      body: n.body,
      link: n.link,
    });
    inserted += 1;
  }

  if (coordinator) {
    await Notification.create({
      userId: coordinator._id,
      type: NOTIFICATION_TYPES.SYSTEM,
      title: "Faculty coordinator dashboard ready",
      body: "Review proposals, ethics applications, and thesis groups for your faculty.",
      link: "/faculty-dashboard",
    });
  }

  return inserted;
}

async function seedPayments(financeOfficer) {
  const count = await Payment.countDocuments();
  const need = Math.max(0, Math.min(TARGET, 5) - count);
  if (!need || !financeOfficer) return 0;

  const budgets = await Budget.find().populate("ownerResearcherId").limit(5);
  let inserted = 0;
  for (const budget of budgets) {
    if (inserted >= need) break;
    const exists = await Payment.exists({ budgetId: budget._id });
    if (exists) continue;
    const requesterId = budget.ownerResearcherId?._id || budget.ownerResearcherId;
    if (!requesterId) continue;
    await Payment.create({
      category: PAYMENT_CATEGORIES.EQUIPMENT,
      budgetId: budget._id,
      payee: "Jamhuriya University Supplies",
      purpose: "Laboratory equipment purchase (sample)",
      amount: 850,
      currency: "USD",
      status: PAYMENT_STATUSES.REQUESTED,
      requestedBy: requesterId,
    });
    inserted += 1;
  }
  return inserted;
}

async function run() {
  await connectDB(process.env.MONGO_URI);

  console.log("=== Jamhuriya RMS institutional seed ===\n");

  console.log("1/4 Users (seedData.js)...");
  const users = await seedUsers();

  const director = users["director@rms.edu"] || users["admin@rms.edu"];
  const coordinator = users["coordinator@rms.edu"];
  const finance = users["finance@rms.edu"];
  const r1 = users["asha@rms.edu"];
  const r2 = users["mahad@rms.edu"];

  if (!director || !r1 || !r2) {
    throw new Error("Missing director or researcher accounts after user seed.");
  }

  const researchers = [r1, r2];

  console.log("2/4 Normalizing legacy SEED labels...");
  await normalizeLegacySeedLabels();

  console.log("3/4 Proposals, projects, grants, publications...");
  const p = await seedProposals(director, researchers);
  const pr = await seedProjects(director, researchers);
  const g = await seedGrantsAndBudgets(researchers, finance);
  const pub = await seedPublications(researchers);
  console.log(`     +${p} proposals, +${pr} projects, +${g} grants, +${pub} publications`);

  console.log("4/4 Groups, thesis, departments, ethics, repository, notifications...");
  const grp = await seedCollaborationGroups(researchers);
  const th = await seedThesisGroups(coordinator, r1, director);
  const dept = await seedDepartments(director);
  const eth = await seedEthics(researchers);
  const repo = await seedRepository(researchers);
  const notif = await seedNotifications(director, coordinator);
  const pay = await seedPayments(finance);
  console.log(
    `     +${grp} collab groups, +${th} thesis, +${dept} departments, +${eth} ethics, +${repo} repository, +${notif} notifications, +${pay} payments`
  );

  const summary = {
    proposals: await Proposal.countDocuments(),
    projects: await Project.countDocuments(),
    grants: await Grant.countDocuments(),
    budgets: await Budget.countDocuments(),
    publications: await Publication.countDocuments(),
    collabGroups: await ResearchGroup.countDocuments({ kind: GROUP_KINDS.COLLABORATION }),
    thesisGroups: await ThesisGroup.countDocuments(),
    departments: await Department.countDocuments(),
    ethics: await EthicsApplication.countDocuments(),
    repository: await RepositoryItem.countDocuments(),
  };

  console.log("\nCounts in database:", summary);
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

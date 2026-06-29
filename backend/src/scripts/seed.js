/**
 * Institutional seed — realistic English research records per portal.
 * Usage: npm run seed
 */
const dotenv = require("dotenv");
dotenv.config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { User, ROLES } = require("../models/User");
const { Proposal, PROPOSAL_STATUSES, ETHICS_STATUSES: PROPOSAL_ETHICS_STATUSES } = require("../models/Proposal");
const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Budget, BUDGET_ITEM_STATUSES, BUDGET_ITEM_TYPES } = require("../models/Budget");
const { Publication, PUBLICATION_STATUSES } = require("../models/Publication");
const { ResearchGroup, GROUP_MEMBER_ROLES, GROUP_KINDS } = require("../models/ResearchGroup");
const { ThesisGroup } = require("../models/ThesisGroup");
const { RepositoryItem, REPOSITORY_ACCESS } = require("../models/RepositoryItem");
const { Notification, NOTIFICATION_TYPES } = require("../models/Notification");
const { Department } = require("../models/Department");
const { EthicsApplication, ETHICS_STATUSES } = require("../models/EthicsApplication");
const { Payment, PAYMENT_CATEGORIES, PAYMENT_STATUSES } = require("../models/Payment");
const { writeSimplePdf } = require("../utils/pdf");
const { syncGrantAwards } = require("../utils/syncGrantAwards");
const { syncGrantProjectLinks } = require("../utils/syncGrantProjectLinks");
const { INSTITUTIONAL_USERS, PORTAL_ORDER, PROGRAM_TIERS } = require("./seedData");
const {
  RECORDS_PER_TIER,
  GRANT_TEMPLATES,
  PUBLICATION_TEMPLATES,
  COLLABORATION_GROUPS,
  THESIS_GROUPS,
  DEPARTMENTS,
  REPOSITORY_ITEMS,
  NOTIFICATION_TEMPLATES,
  proposalsForTier,
} = require("./seedRecords");

function splitPersonName(fullName) {
  const cleaned = String(fullName || "")
    .trim()
    .replace(/^Dr\.\s*/i, "");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function principalFromResearcher(researcher, department) {
  const { firstName, lastName } = splitPersonName(researcher.fullName);
  return {
    firstName,
    lastName,
    email: researcher.email,
    department: department || researcher.department || "",
  };
}

async function upsertUser(spec) {
  const email = String(spec.email).toLowerCase().trim();
  const existing = await User.findOne({ email }).select("+password isProtected");
  if (existing) {
    existing.fullName = spec.fullName;
    existing.role = spec.role;
    existing.department = spec.department;
    existing.rank = spec.rank;
    existing.status = spec.status;
    if (spec.programTier) existing.programTier = spec.programTier;
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
    programTier: spec.programTier,
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
    legacyAdmin.role = ROLES.RESEARCH_DIRECTOR;
    legacyAdmin.status = INSTITUTIONAL_USERS[0].status;
    legacyAdmin.isProtected = true;
    await legacyAdmin.save();
    users["admin@rms.edu"] = legacyAdmin;
  }

  return users;
}

async function portalContext(users, programTier) {
  const director = users["director@rms.edu"] || users["admin@rms.edu"];
  const researchers = Object.values(users).filter(
    (u) => u.role === ROLES.RESEARCHER && String(u.programTier) === String(programTier)
  );
  const coordinator = Object.values(users).find(
    (u) => u.role === ROLES.FACULTY_COORDINATOR && String(u.programTier) === String(programTier)
  );
  const finance = Object.values(users).find(
    (u) => u.role === ROLES.FINANCE_OFFICER && String(u.programTier) === String(programTier)
  );
  return { programTier, director, researchers, coordinator, finance };
}

async function existsByTitle(Model, title, programTier) {
  return Model.exists({ title, programTier });
}

async function seedDepartments(ctx) {
  const { programTier, coordinator } = ctx;
  let inserted = 0;
  for (const dept of DEPARTMENTS) {
    const exists = await Department.exists({ code: dept.code, programTier });
    if (exists) continue;
    await Department.create({
      ...dept,
      programTier,
      createdBy: coordinator?._id || ctx.researchers[0]._id,
    });
    inserted += 1;
  }
  return inserted;
}

async function seedProposals(ctx) {
  const { programTier, researchers } = ctx;
  const templates = proposalsForTier(programTier).slice(0, RECORDS_PER_TIER);
  const uploadsDir = path.join(__dirname, "../../uploads");
  let inserted = 0;

  for (let i = 0; i < templates.length; i += 1) {
    const sample = templates[i];
    if (await existsByTitle(Proposal, sample.title, programTier)) continue;

    const researcher = researchers[i % researchers.length];
    const slug = sample.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 60).toLowerCase();
    const pdfName = `proposal-${programTier}-${slug}.pdf`;
    const pdfPath = path.join(uploadsDir, pdfName);

    await writeSimplePdf({
      filePath: pdfPath,
      title: sample.title,
      author: researcher.fullName,
      bodyLines: [
        sample.abstract,
        "",
        "Department: " + sample.department,
        "Research area: " + sample.researchArea,
        "",
        "Jamhuriya University — Research Management System",
      ],
    });

    const ethicsStatus =
      sample.status === PROPOSAL_STATUSES.APPROVED
        ? PROPOSAL_ETHICS_STATUSES.APPROVED
        : sample.status === PROPOSAL_STATUSES.SUBMITTED || sample.status === PROPOSAL_STATUSES.UNDER_REVIEW
          ? PROPOSAL_ETHICS_STATUSES.PENDING
          : PROPOSAL_ETHICS_STATUSES.NOT_REQUIRED;

    await Proposal.create({
      title: sample.title,
      abstract: sample.abstract,
      department: sample.department,
      researchArea: sample.researchArea,
      document: `/uploads/${pdfName}`,
      researcherId: researcher._id,
      programTier,
      status: sample.status,
      requiresEthics: true,
      ethicsStatus,
      submittedAt:
        sample.status !== PROPOSAL_STATUSES.DRAFT ? new Date(Date.now() - (i + 1) * 86400000 * 7) : null,
    });
    inserted += 1;
  }
  return inserted;
}

async function seedEthics(ctx) {
  const { programTier, researchers } = ctx;
  const proposals = await Proposal.find({
    programTier,
    status: { $in: [PROPOSAL_STATUSES.APPROVED, PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW] },
  }).limit(RECORDS_PER_TIER);

  let inserted = 0;
  for (const proposal of proposals) {
    const researcher = researchers.find((r) => String(r._id) === String(proposal.researcherId)) || researchers[0];
    const approved = proposal.status === PROPOSAL_STATUSES.APPROVED;
    const principal = principalFromResearcher(researcher, proposal.department);

    const existing = await EthicsApplication.findOne({ proposalId: proposal._id });
    if (existing) {
      existing.principal = { ...existing.principal, ...principal };
      existing.projectTitle = proposal.title;
      existing.applicantSignature = { name: researcher.fullName };
      await existing.save();
      continue;
    }

    await EthicsApplication.create({
      proposalId: proposal._id,
      researcherId: researcher._id,
      programTier,
      status: approved ? ETHICS_STATUSES.APPROVED : ETHICS_STATUSES.SUBMITTED,
      projectTitle: proposal.title,
      projectLevel: programTier === PROGRAM_TIERS.POSTGRADUATE ? "master" : "undergraduate",
      backgroundLiterature: proposal.abstract,
      aimsObjectives: "Define measurable outcomes aligned with the approved proposal scope.",
      rationale: "The study addresses a documented gap in " + proposal.researchArea + ".",
      design: "Mixed-methods design with documented data collection instruments.",
      subjectTypes: ["human"],
      risk: { level: "minimal", description: "Standard survey and interview procedures with informed consent." },
      sampleSize: approved ? "120 participants" : "To be finalized after pilot",
      consent: { hasForm: true, language: "english", interpreter: false },
      principal,
      applicantSignature: { name: researcher.fullName },
    });

    proposal.ethicsStatus = approved ? PROPOSAL_ETHICS_STATUSES.APPROVED : PROPOSAL_ETHICS_STATUSES.PENDING;
    await proposal.save();
    inserted += 1;
  }
  return inserted;
}

async function seedProjects(ctx) {
  const { programTier, researchers } = ctx;
  const approved = await Proposal.find({ programTier, status: PROPOSAL_STATUSES.APPROVED });
  let inserted = 0;

  for (const proposal of approved) {
    if (await Project.exists({ proposalId: proposal._id })) continue;

    const researcher = researchers.find((r) => String(r._id) === String(proposal.researcherId)) || researchers[0];
    await Project.create({
      proposalId: proposal._id,
      title: proposal.title,
      researcherId: researcher._id,
      programTier,
      status: PROJECT_STATUSES.ACTIVE,
      startDate: new Date(Date.now() - 90 * 86400000),
      endDate: new Date(Date.now() + 365 * 86400000),
      milestones: [
        { title: "Literature review complete", dueDate: new Date(Date.now() - 60 * 86400000), completed: true },
        { title: "Data collection phase", dueDate: new Date(Date.now() + 60 * 86400000), completed: false },
        { title: "Analysis and reporting", dueDate: new Date(Date.now() + 180 * 86400000), completed: false },
      ],
      progressReports: [
        {
          note: "Initial setup complete; ethics clearance obtained and instruments finalized.",
          progressPercent: 25,
          createdBy: researcher._id,
        },
      ],
    });
    inserted += 1;
  }
  return inserted;
}

async function seedGrantsAndBudgets(ctx) {
  const { programTier, researchers, finance } = ctx;
  const templates = GRANT_TEMPLATES.slice(0, RECORDS_PER_TIER);
  let inserted = 0;

  for (let i = 0; i < templates.length; i += 1) {
    const tpl = templates[i];
    const title = tpl.title;
    if (await existsByTitle(Grant, title, programTier)) continue;

    const researcher = researchers[i % researchers.length];
    const proposalDefs = proposalsForTier(programTier);
    const proposalTpl = proposalDefs[i % proposalDefs.length];
    const proposal = await Proposal.findOne({
      programTier,
      title: proposalTpl.title,
      researcherId: researcher._id,
    });
    const project = proposal ? await Project.findOne({ proposalId: proposal._id }) : null;
    const awarded =
      tpl.status === GRANT_STATUSES.ACTIVE || tpl.status === GRANT_STATUSES.APPROVED
        ? Math.round(tpl.amountRequested * (tpl.awardRatio || 1))
        : 0;

    const grant = await Grant.create({
      title,
      fundingSource: tpl.fundingSource,
      currency: "USD",
      amountRequested: tpl.amountRequested,
      amountAwarded: awarded,
      status: tpl.status,
      researcherId: researcher._id,
      projectId: project?._id || null,
      programTier,
      submittedAt: tpl.status !== GRANT_STATUSES.DRAFT ? new Date(Date.now() - (i + 2) * 86400000 * 14) : null,
      decidedAt: awarded > 0 ? new Date(Date.now() - (i + 1) * 86400000 * 7) : null,
    });

    if (awarded > 0 && project) {
      const existsBudget = await Budget.exists({ grantId: grant._id });
      if (!existsBudget) {
        await Budget.create({
          grantId: grant._id,
          projectId: project._id,
          ownerResearcherId: researcher._id,
          programTier,
          totalAllocated: awarded,
          currency: "USD",
          items: [
            {
              type: BUDGET_ITEM_TYPES.EXPENSE,
              description: "Research equipment and consumables",
              amount: Math.round(awarded * 0.45),
              status: BUDGET_ITEM_STATUSES.APPROVED,
              createdBy: researcher._id,
              approvedBy: finance?._id || researcher._id,
            },
            {
              type: BUDGET_ITEM_TYPES.EXPENSE,
              description: "Field data collection and participant incentives",
              amount: Math.round(awarded * 0.3),
              status: BUDGET_ITEM_STATUSES.PENDING,
              createdBy: researcher._id,
            },
            {
              type: BUDGET_ITEM_TYPES.PROCUREMENT,
              description: "Software licenses and cloud compute credits",
              amount: Math.round(awarded * 0.25),
              status: BUDGET_ITEM_STATUSES.PAID,
              createdBy: researcher._id,
              approvedBy: finance?._id || researcher._id,
              paidAt: new Date(Date.now() - 14 * 86400000),
            },
          ],
        });
      }
    }
    inserted += 1;
  }
  return inserted;
}

async function seedPublications(ctx) {
  const { programTier, researchers, coordinator } = ctx;
  const templates = PUBLICATION_TEMPLATES.slice(0, RECORDS_PER_TIER);
  const proposalDefs = proposalsForTier(programTier);
  let inserted = 0;

  for (let i = 0; i < templates.length; i += 1) {
    const tpl = templates[i];
    if (await existsByTitle(Publication, tpl.title, programTier)) continue;

    const researcher = researchers[i % researchers.length];
    const proposalTpl = proposalDefs[i % proposalDefs.length];
    const proposal = await Proposal.findOne({
      programTier,
      title: proposalTpl.title,
      researcherId: researcher._id,
    });
    const project = proposal ? await Project.findOne({ proposalId: proposal._id }) : null;

    await Publication.create({
      ...tpl,
      researcherId: researcher._id,
      projectId: project?._id || null,
      programTier,
      authors: [researcher.fullName],
      doi: tpl.status === PUBLICATION_STATUSES.VALIDATED ? `10.1000/rms.${programTier}.${i + 1}` : "",
      validatedBy: tpl.status === PUBLICATION_STATUSES.VALIDATED ? coordinator?._id : null,
      validatedAt: tpl.status === PUBLICATION_STATUSES.VALIDATED ? new Date(Date.now() - i * 86400000 * 10) : null,
    });
    inserted += 1;
  }
  return inserted;
}

async function seedCollaborationGroups(ctx) {
  const { programTier, researchers, coordinator } = ctx;
  let inserted = 0;

  for (let i = 0; i < Math.min(COLLABORATION_GROUPS.length, RECORDS_PER_TIER); i += 1) {
    const tpl = COLLABORATION_GROUPS[i];
    if (await ResearchGroup.exists({ name: tpl.name, programTier })) continue;

    const lead = researchers[i % researchers.length];
    const members = researchers.map((r, idx) => ({
      userId: r._id,
      role: idx === i % researchers.length ? GROUP_MEMBER_ROLES.LEAD : GROUP_MEMBER_ROLES.MEMBER,
    }));

    await ResearchGroup.create({
      name: tpl.name,
      description: tpl.description,
      kind: GROUP_KINDS.COLLABORATION,
      createdBy: coordinator?._id || lead._id,
      members,
      programTier,
    });
    inserted += 1;
  }
  return inserted;
}

async function seedThesisGroups(ctx) {
  const { programTier, researchers, coordinator } = ctx;
  let inserted = 0;

  for (let i = 0; i < Math.min(THESIS_GROUPS.length, RECORDS_PER_TIER); i += 1) {
    const tpl = THESIS_GROUPS[i];
    if (await ThesisGroup.exists({ title: tpl.title, programTier })) continue;

    const supervisor = researchers[i % researchers.length];
    const collab = await ResearchGroup.findOne({ programTier, "members.userId": supervisor._id });

    await ThesisGroup.create({
      title: tpl.title,
      students: tpl.students,
      researchGroupId: collab?._id || null,
      supervisorId: supervisor._id,
      coordinatorId: coordinator?._id || null,
      department: tpl.department,
      faculty: tpl.faculty,
      facultyResearchArea: tpl.facultyResearchArea,
      status: tpl.status,
      meetingSchedule: tpl.meetingSchedule,
      createdBy: coordinator?._id || supervisor._id,
      programTier,
    });
    inserted += 1;
  }
  return inserted;
}

async function ensureRepositoryFile(fileName, content) {
  const uploadsDir = path.join(__dirname, "../../uploads/repository");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, fileName);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, content, "utf8");
  return `/uploads/repository/${fileName}`;
}

async function seedRepository(ctx) {
  const { programTier, researchers } = ctx;
  const proposalDefs = proposalsForTier(programTier);
  let inserted = 0;

  for (let i = 0; i < Math.min(REPOSITORY_ITEMS.length, RECORDS_PER_TIER); i += 1) {
    const tpl = REPOSITORY_ITEMS[i];
    if (await existsByTitle(RepositoryItem, tpl.title, programTier)) continue;

    const researcher = researchers[i % researchers.length];
    const proposalTpl = proposalDefs[i % proposalDefs.length];
    const proposal = await Proposal.findOne({
      programTier,
      title: proposalTpl.title,
      researcherId: researcher._id,
    });
    const project = proposal ? await Project.findOne({ proposalId: proposal._id }) : null;
    const fileName = `${programTier}-${i + 1}-${tpl.type}.txt`;
    const filePath = await ensureRepositoryFile(
      fileName,
      `${tpl.title}\n\n${tpl.description}\n\nJamhuriya University Research Repository\n`
    );

    await RepositoryItem.create({
      type: tpl.type,
      title: tpl.title,
      description: tpl.description,
      tags: tpl.tags,
      filePath,
      fileSize: Buffer.byteLength(tpl.description, "utf8") + 128,
      access: REPOSITORY_ACCESS.INSTITUTION,
      uploadedBy: researcher._id,
      projectId: project?._id || null,
      programTier,
    });
    inserted += 1;
  }
  return inserted;
}

async function seedNotifications(ctx) {
  const { programTier, researchers } = ctx;
  let inserted = 0;

  for (let i = 0; i < Math.min(NOTIFICATION_TEMPLATES.length, RECORDS_PER_TIER); i += 1) {
    const tpl = NOTIFICATION_TEMPLATES[i];
    const researcher = researchers[i % researchers.length];
    const exists = await Notification.exists({
      programTier,
      userId: researcher._id,
      title: tpl.title,
    });
    if (exists) continue;

    await Notification.create({
      userId: researcher._id,
      type: NOTIFICATION_TYPES[tpl.type.toUpperCase()] || NOTIFICATION_TYPES.SYSTEM,
      title: tpl.title,
      body: tpl.body,
      programTier,
      readAt: i % 4 === 0 ? new Date() : null,
    });
    inserted += 1;
  }
  return inserted;
}

async function seedPayments(ctx) {
  const { programTier, finance, researchers } = ctx;
  const budgets = await Budget.find({ programTier }).populate("ownerResearcherId").limit(8);
  let inserted = 0;

  for (const budget of budgets) {
    if (inserted >= 6) break;
    const exists = await Payment.exists({ budgetId: budget._id, programTier });
    if (exists) continue;

    const requesterId = budget.ownerResearcherId?._id || budget.ownerResearcherId || researchers[0]._id;
    await Payment.create({
      category: PAYMENT_CATEGORIES.EQUIPMENT,
      budgetId: budget._id,
      programTier,
      payee: "University Approved Supplier",
      purpose: "Laboratory equipment purchase per approved budget line",
      amount: 1250 + inserted * 400,
      currency: "USD",
      status: inserted % 2 === 0 ? PAYMENT_STATUSES.REQUESTED : PAYMENT_STATUSES.APPROVED,
      requestedBy: requesterId,
    });
    inserted += 1;
  }
  return inserted;
}

async function seedPortal(ctx) {
  console.log(`\n--- Portal: ${ctx.programTier} ---`);

  const dept = await seedDepartments(ctx);
  const p = await seedProposals(ctx);
  const eth = await seedEthics(ctx);
  const pr = await seedProjects(ctx);
  const g = await seedGrantsAndBudgets(ctx);
  const awardSync = await syncGrantAwards({ programTier: ctx.programTier });
  const linkSync = await syncGrantProjectLinks({ programTier: ctx.programTier });
  const pub = await seedPublications(ctx);
  const grp = await seedCollaborationGroups(ctx);
  const th = await seedThesisGroups(ctx);
  const repo = await seedRepository(ctx);
  const notif = await seedNotifications(ctx);
  const pay = await seedPayments(ctx);

  console.log(
    `  +${dept} departments, +${p} proposals, +${eth} ethics, +${pr} projects, +${g} grants, +${pub} publications, +${grp} groups, +${th} thesis, +${repo} repository, +${notif} notifications, +${pay} payments`
  );
  if (awardSync.updated) console.log(`  synced ${awardSync.updated} grant award amount(s)`);
  if (linkSync.updated) console.log(`  linked ${linkSync.updated} grant(s) to project(s)`);
}

async function repairRepositoryAccess() {
  const result = await RepositoryItem.updateMany(
    { access: REPOSITORY_ACCESS.PRIVATE },
    { $set: { access: REPOSITORY_ACCESS.INSTITUTION } }
  );
  return result.modifiedCount || 0;
}

async function run() {
  await connectDB(process.env.MONGO_URI);

  console.log("=== Jamhuriya RMS institutional seed ===\n");
  console.log("1/3 User accounts...");
  const users = await seedUsers();
  console.log(`     ${INSTITUTIONAL_USERS.length} accounts upserted`);

  console.log("2/3 Research records (English, per portal)...");
  for (const tier of PORTAL_ORDER) {
    const ctx = await portalContext(users, tier);
    if (ctx.researchers.length < 1) {
      throw new Error(`Portal ${tier} needs at least one researcher in seedData.js`);
    }
    await seedPortal(ctx);
  }

  console.log("3/3 Data repairs...");
  const repoFixed = await repairRepositoryAccess();
  if (repoFixed) console.log(`     ${repoFixed} repository item(s) set to institution access`);

  console.log("\nSeed complete. Sign in with credentials from backend/.env or seedData.js");
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

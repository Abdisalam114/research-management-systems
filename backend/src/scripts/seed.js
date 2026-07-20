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
const { FundingCall, CALL_STATUSES } = require("../models/FundingCall");
const { AuditEvent } = require("../models/AuditEvent");
const { recordAudit } = require("../utils/audit");
const { writeSimplePdf } = require("../utils/pdf");
const { syncGrantAwards } = require("../utils/syncGrantAwards");
const { syncGrantProjectLinks } = require("../utils/syncGrantProjectLinks");
const { defaultChapters, TITLE_PROPOSAL_STATUSES, MIN_THESIS_GROUP_STUDENTS } = require("../utils/thesisDefaults");
const { INSTITUTIONAL_POLICY_CATALOG } = require("../constants/institutionalPolicyCatalog");
const { InstitutionalPolicy } = require("../models/InstitutionalPolicy");
const { INSTITUTIONAL_USERS, PORTAL_ORDER, PROGRAM_TIERS, REMOVED_INSTITUTIONAL_EMAILS } = require("./seedData");
  RECORDS_PER_TIER,
  MAX_SAMPLE_RECORDS,
  GRANT_TEMPLATES,
  PUBLICATION_TEMPLATES,
  COLLABORATION_GROUPS,
  THESIS_GROUPS,
  DEPARTMENTS,
  REPOSITORY_ITEMS,
  NOTIFICATION_TEMPLATES,
  FUNDING_CALL_TEMPLATES,
  proposalsForTier,
} = require("./seedRecords");

async function seedInstitutionalPolicies(users) {
  const leadership =
    users.find((u) => u.role === ROLES.LEADERSHIP) ||
    users.find((u) => u.role === ROLES.RESEARCH_DIRECTOR);
  if (!leadership) return 0;
  let count = 0;
  for (const tier of PORTAL_ORDER) {
    for (const spec of INSTITUTIONAL_POLICY_CATALOG) {
      const existing = await InstitutionalPolicy.findOne({ programTier: tier, moduleKey: spec.moduleKey });
      if (existing) {
        existing.title = spec.title;
        existing.body = spec.body;
        existing.category = spec.category;
        existing.status = "published";
        existing.updatedBy = leadership._id;
        await existing.save();
      } else {
        await InstitutionalPolicy.create({
          programTier: tier,
          moduleKey: spec.moduleKey,
          title: spec.title,
          body: spec.body,
          category: spec.category,
          status: "published",
          updatedBy: leadership._id,
        });
      }
      count += 1;
    }
  }
  return count;
}

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

  for (const email of REMOVED_INSTITUTIONAL_EMAILS) {
    await User.deleteOne({ email: String(email).toLowerCase().trim() });
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

async function sampleSlots(Model, programTier, extraFilter = {}) {
  const count = await Model.countDocuments({ programTier, ...extraFilter });
  return Math.max(0, MAX_SAMPLE_RECORDS - count);
}

function facultySlugForJurec(department) {
  return String(department || "faculty")
    .trim()
    .toLowerCase()
    .replace(/\//g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

function jurecCertificateMeta(index, department, issueDate = new Date()) {
  const seq = String(index + 1).padStart(4, "0");
  const faculty = facultySlugForJurec(department);
  const suffix = `${String(issueDate.getMonth() + 1).padStart(2, "0")}${issueDate.getFullYear()}`;
  const refNumber = `JUREC/${seq}/${faculty}/${suffix}`;
  const certificateNumber = `JUREC${seq}/${faculty}/${suffix}`;
  return { refNumber, certificateNumber, serialNumber: refNumber };
}

function defaultAcademicYear(date = new Date()) {
  const y = date.getFullYear();
  return `${y}/${y + 1}`;
}

async function existsByTitle(Model, title, programTier) {
  return Model.exists({ title, programTier });
}

async function auditOnce(payload) {
  const exists = await AuditEvent.exists({
    entityType: payload.entityType,
    entityId: payload.entityId,
    action: payload.action,
  });
  if (exists) return false;
  await recordAudit(payload);
  return true;
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
  const slots = await sampleSlots(Proposal, programTier);
  if (slots < 1) return 0;
  const templates = proposalsForTier(programTier).slice(0, Math.min(slots, RECORDS_PER_TIER));
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
  const { programTier, researchers, director } = ctx;
  const ethicsSlots = await sampleSlots(EthicsApplication, programTier);
  if (ethicsSlots < 1) return 0;

  const proposals = await Proposal.find({
    programTier,
    status: { $in: [PROPOSAL_STATUSES.APPROVED, PROPOSAL_STATUSES.SUBMITTED, PROPOSAL_STATUSES.UNDER_REVIEW] },
  }).limit(ethicsSlots);

  let inserted = 0;
  for (const proposal of proposals) {
    const researcher = researchers.find((r) => String(r._id) === String(proposal.researcherId)) || researchers[0];
    const approved = proposal.status === PROPOSAL_STATUSES.APPROVED;
    const principal = principalFromResearcher(researcher, proposal.department);
    const submittedAt = proposal.submittedAt || new Date(Date.now() - (inserted + 1) * 86400000 * 5);

    const existing = await EthicsApplication.findOne({ proposalId: proposal._id });
    if (existing) {
      existing.principal = { ...existing.principal, ...principal };
      existing.projectTitle = proposal.title;
      existing.applicantSignature = { name: researcher.fullName, signedAt: submittedAt };
      if (approved && !existing.approval?.refNumber) {
        const signedAt = new Date(Date.now() - (inserted + 1) * 86400000 * 3);
        const jurec = jurecCertificateMeta(inserted, proposal.department, signedAt);
        const signatoryKey = inserted % 2 === 0 ? "kasim" : "nur";
        const chairpersonLine =
          signatoryKey === "kasim" ? "Kasim Abdi Jimale" : "Dr. Nur Rashid Ahmed";
        existing.status = ETHICS_STATUSES.APPROVED;
        existing.submittedAt = submittedAt;
        existing.approval = {
          decision: "approved",
          signedByUserId: director._id,
          signedByName: director.fullName,
          signedAt,
          certificateId: jurec.certificateNumber,
          serialNumber: jurec.serialNumber,
          refNumber: jurec.refNumber,
          certificateNumber: jurec.certificateNumber,
          academicYear: defaultAcademicYear(signedAt),
          year: String(signedAt.getFullYear()),
          receivedAt: submittedAt,
          reviewedAt: new Date(signedAt.getTime() - 86400000 * 2),
          chairpersonLine,
          signatoryKey,
          signatoryTitle: "Chairperson",
          includeSignature: true,
          includeStamp: true,
        };
      }
      await existing.save();
      continue;
    }

    const ethicsDoc = {
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
      applicantSignature: { name: researcher.fullName, signedAt: submittedAt },
      submittedAt,
    };

    if (approved) {
      const signedAt = new Date(Date.now() - (inserted + 1) * 86400000 * 3);
      const jurec = jurecCertificateMeta(inserted, proposal.department, signedAt);
      const signatoryKey = inserted % 2 === 0 ? "kasim" : "nur";
      const chairpersonLine = signatoryKey === "kasim" ? "Kasim Abdi Jimale" : "Dr. Nur Rashid Ahmed";
      ethicsDoc.approval = {
        decision: "approved",
        signedByUserId: director._id,
        signedByName: director.fullName,
        signedAt,
        certificateId: jurec.certificateNumber,
        serialNumber: jurec.serialNumber,
        refNumber: jurec.refNumber,
        certificateNumber: jurec.certificateNumber,
        academicYear: defaultAcademicYear(signedAt),
        year: String(signedAt.getFullYear()),
        receivedAt: submittedAt,
        reviewedAt: new Date(signedAt.getTime() - 86400000 * 2),
        chairpersonLine,
        signatoryKey,
        signatoryTitle: "Chairperson",
        includeSignature: true,
        includeStamp: true,
      };
    }

    await EthicsApplication.create(ethicsDoc);

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
  const slots = await sampleSlots(Grant, programTier);
  if (slots < 1) return 0;
  const templates = GRANT_TEMPLATES.slice(0, Math.min(slots, RECORDS_PER_TIER));
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
  // Demo publications disabled — outputs must be registered by researchers on real Projects (1:1).
  // Seed must not create fake outputs that appear in Publications & Outputs menu.
  return 0;

  const { programTier, researchers, coordinator } = ctx;
  const slots = await sampleSlots(Publication, programTier);
  if (slots < 1) return 0;
  const templates = PUBLICATION_TEMPLATES.slice(0, Math.min(slots, RECORDS_PER_TIER));
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

    // Only seed publications onto recognized projects (skip if no approved project)
    if (!project) continue;
    if (await Publication.exists({ projectId: project._id })) continue;

    const { citations, ...pubFields } = tpl;
    await Publication.create({
      ...pubFields,
      citationCount: typeof citations === "number" ? citations : tpl.citationCount || 0,
      researcherId: researcher._id,
      projectId: project._id,
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
  const slots = await sampleSlots(ResearchGroup, programTier, { kind: GROUP_KINDS.COLLABORATION });
  if (slots < 1) return 0;
  let inserted = 0;

  for (let i = 0; i < Math.min(COLLABORATION_GROUPS.length, slots); i += 1) {
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
  const slots = await sampleSlots(ThesisGroup, programTier);
  if (slots < 1) return 0;
  let inserted = 0;

  for (let i = 0; i < Math.min(THESIS_GROUPS.length, slots); i += 1) {
    const tpl = THESIS_GROUPS[i];
    const existing = await ThesisGroup.findOne({ title: tpl.title, programTier });
    if (existing) {
      if ((existing.students?.length || 0) < MIN_THESIS_GROUP_STUDENTS && tpl.students.length >= MIN_THESIS_GROUP_STUDENTS) {
        existing.students = tpl.students;
        await existing.save();
      }
      continue;
    }

    const supervisor = researchers[i % researchers.length];
    const collab = await ResearchGroup.findOne({ programTier, "members.userId": supervisor._id });

    const reviewerId = coordinator?._id || supervisor._id;
    const acceptedAt = new Date();

    await ThesisGroup.create({
      title: tpl.title,
      titleProposal: {
        title: tpl.title,
        status: TITLE_PROPOSAL_STATUSES.ACCEPTED,
        proposedAt: acceptedAt,
        proposedBy: supervisor._id,
        reviewedAt: acceptedAt,
        reviewedBy: reviewerId,
        reviewNote: "",
      },
      chapters: defaultChapters(),
      students: tpl.students,
      researchGroupId: collab?._id || null,
      supervisorId: supervisor._id,
      coordinatorId: coordinator?._id || null,
      department: tpl.department,
      faculty: tpl.faculty,
      facultyResearchArea: tpl.facultyResearchArea,
      status: tpl.status,
      meetingSchedule: tpl.meetingSchedule,
      createdBy: reviewerId,
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
  // Demo repository files disabled — uploads must come from real Projects.
  return 0;

  const { programTier, researchers } = ctx;
  const slots = await sampleSlots(RepositoryItem, programTier);
  if (slots < 1) return 0;
  const proposalDefs = proposalsForTier(programTier);
  let inserted = 0;

  for (let i = 0; i < Math.min(REPOSITORY_ITEMS.length, slots); i += 1) {
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
  const slots = await sampleSlots(Notification, programTier);
  if (slots < 1) return 0;
  let inserted = 0;

  for (let i = 0; i < Math.min(NOTIFICATION_TEMPLATES.length, slots); i += 1) {
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
  const slots = await sampleSlots(Payment, programTier);
  if (slots < 1) return 0;
  const budgets = await Budget.find({ programTier }).populate("ownerResearcherId").limit(slots);
  let inserted = 0;

  for (const budget of budgets) {
    if (inserted >= slots) break;
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

async function seedFundingCalls(ctx) {
  const { programTier, director } = ctx;
  const slots = await sampleSlots(FundingCall, programTier);
  if (slots < 1) return 0;
  let inserted = 0;

  for (let i = 0; i < Math.min(FUNDING_CALL_TEMPLATES.length, slots); i += 1) {
    const tpl = FUNDING_CALL_TEMPLATES[i];
    if (await existsByTitle(FundingCall, tpl.title, programTier)) continue;

    const deadline =
      tpl.daysUntilDeadline != null ? new Date(Date.now() + tpl.daysUntilDeadline * 86400000) : null;
    const publishedAt =
      tpl.status === CALL_STATUSES.OPEN || tpl.status === CALL_STATUSES.CLOSED
        ? new Date(Date.now() - (i + 1) * 86400000 * 7)
        : null;
    const closedAt = tpl.status === CALL_STATUSES.CLOSED ? new Date(Date.now() - 86400000 * 3) : null;

    await FundingCall.create({
      title: tpl.title,
      description: tpl.description,
      fundingSource: tpl.fundingSource,
      donorRef: tpl.donorRef,
      amountCap: tpl.amountCap,
      currency: "USD",
      deadline,
      eligibilityTier: tpl.eligibilityTier,
      requiredDocuments: "CV, budget breakdown, ethics approval (if human subjects), and signed institutional endorsement.",
      status: tpl.status,
      publishedAt,
      closedAt,
      createdBy: director._id,
      programTier,
    });
    inserted += 1;
  }
  return inserted;
}

async function seedAuditTrail(ctx) {
  const { programTier, director, coordinator, finance } = ctx;
  let inserted = 0;

  const proposals = await Proposal.find({ programTier }).limit(MAX_SAMPLE_RECORDS);
  for (const proposal of proposals) {
    if (
      await auditOnce({
        entityType: "proposal",
        entityId: proposal._id,
        action: "submitted",
        label: "Proposal submitted",
        detail: proposal.title,
        actorId: proposal.researcherId,
        actorRole: "researcher",
        programTier,
      })
    ) {
      inserted += 1;
    }
    if (proposal.status === PROPOSAL_STATUSES.APPROVED) {
      if (
        await auditOnce({
          entityType: "proposal",
          entityId: proposal._id,
          action: "director_approved",
          label: "Director decision: approved",
          detail: proposal.title,
          actorId: director._id,
          actorRole: director.role,
          programTier,
        })
      ) {
        inserted += 1;
      }
    }
  }

  const ethicsApps = await EthicsApplication.find({ programTier }).limit(MAX_SAMPLE_RECORDS);
  for (const app of ethicsApps) {
    if (
      await auditOnce({
        entityType: "ethics",
        entityId: app._id,
        action: "submitted",
        label: "Ethics application submitted",
        detail: app.projectTitle,
        actorId: app.researcherId,
        actorRole: "researcher",
        programTier,
      })
    ) {
      inserted += 1;
    }
    if (app.status === ETHICS_STATUSES.APPROVED && app.approval?.refNumber) {
      if (
        await auditOnce({
          entityType: "ethics",
          entityId: app._id,
          action: "certificate_issued",
          label: "JUREC certificate issued",
          detail: `${app.approval.refNumber} · ${app.approval.certificateNumber}`,
          actorId: director._id,
          actorRole: director.role,
          metadata: {
            refNumber: app.approval.refNumber,
            certificateNumber: app.approval.certificateNumber,
            signatoryKey: app.approval.signatoryKey,
          },
          programTier,
        })
      ) {
        inserted += 1;
      }
    }
  }

  const projects = await Project.find({ programTier }).limit(MAX_SAMPLE_RECORDS);
  for (const project of projects) {
    if (
      await auditOnce({
        entityType: "project",
        entityId: project._id,
        action: "created",
        label: "Project created from approved proposal",
        detail: project.title,
        actorId: director._id,
        actorRole: director.role,
        programTier,
      })
    ) {
      inserted += 1;
    }
  }

  const grants = await Grant.find({ programTier }).limit(MAX_SAMPLE_RECORDS);
  for (const grant of grants) {
    if (
      await auditOnce({
        entityType: "grant",
        entityId: grant._id,
        action: "created",
        label: "Grant application created",
        detail: grant.title,
        actorId: grant.researcherId,
        actorRole: "researcher",
        programTier,
      })
    ) {
      inserted += 1;
    }
    if (grant.submittedAt) {
      if (
        await auditOnce({
          entityType: "grant",
          entityId: grant._id,
          action: "submitted",
          label: "Grant submitted",
          detail: grant.title,
          actorId: grant.researcherId,
          actorRole: "researcher",
          programTier,
        })
      ) {
        inserted += 1;
      }
    }
    if ([GRANT_STATUSES.APPROVED, GRANT_STATUSES.ACTIVE].includes(grant.status)) {
      if (
        await auditOnce({
          entityType: "grant",
          entityId: grant._id,
          action: "director_approved",
          label: "Director approved grant",
          detail: grant.title,
          actorId: director._id,
          actorRole: director.role,
          programTier,
        })
      ) {
        inserted += 1;
      }
      if (grant.amountAwarded > 0 && finance) {
        if (
          await auditOnce({
            entityType: "grant",
            entityId: grant._id,
            action: "finance_approved",
            label: "Finance approved grant",
            detail: grant.title,
            actorId: finance._id,
            actorRole: finance.role,
            programTier,
          })
        ) {
          inserted += 1;
        }
      }
    }
  }

  const calls = await FundingCall.find({ programTier }).limit(MAX_SAMPLE_RECORDS);
  for (const call of calls) {
    if (
      await auditOnce({
        entityType: "funding_call",
        entityId: call._id,
        action: "created",
        label: "Funding call created",
        detail: call.title,
        actorId: director._id,
        actorRole: director.role,
        programTier,
      })
    ) {
      inserted += 1;
    }
    if (call.publishedAt) {
      if (
        await auditOnce({
          entityType: "funding_call",
          entityId: call._id,
          action: "published",
          label: "Funding call published",
          detail: call.title,
          actorId: director._id,
          actorRole: director.role,
          programTier,
        })
      ) {
        inserted += 1;
      }
    }
    if (call.status === CALL_STATUSES.CLOSED) {
      if (
        await auditOnce({
          entityType: "funding_call",
          entityId: call._id,
          action: "closed",
          label: "Funding call closed",
          detail: call.title,
          actorId: director._id,
          actorRole: director.role,
          programTier,
        })
      ) {
        inserted += 1;
      }
    }
  }

  if (coordinator) {
    const publications = await Publication.find({ programTier, status: PUBLICATION_STATUSES.VALIDATED }).limit(
      MAX_SAMPLE_RECORDS
    );
    for (const pub of publications) {
      if (
        await auditOnce({
          entityType: "publication",
          entityId: pub._id,
          action: "validated",
          label: "Publication validated",
          detail: pub.title,
          actorId: coordinator._id,
          actorRole: coordinator.role,
          programTier,
        })
      ) {
        inserted += 1;
      }
    }
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
  const fc = await seedFundingCalls(ctx);
  const audit = await seedAuditTrail(ctx);

  console.log(
    `  +${dept} departments, +${p} proposals, +${eth} ethics, +${pr} projects, +${g} grants, +${fc} funding calls, +${pub} publications, +${grp} groups, +${th} thesis, +${repo} repository, +${notif} notifications, +${pay} payments, +${audit} audit events`
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
  console.log(`Sample cap: ${MAX_SAMPLE_RECORDS} records per entity type per portal.\n`);
  console.log("1/3 User accounts...");
  const users = await seedUsers();
  await User.updateMany({ role: { $ne: ROLES.RESEARCH_DIRECTOR } }, { $unset: { programTiers: "" } });
  console.log(`     ${INSTITUTIONAL_USERS.length} accounts upserted`);

  console.log("2/3 Research records (English, realistic, audit trail)...");
  for (const tier of PORTAL_ORDER) {
    const ctx = await portalContext(users, tier);
    if (ctx.researchers.length < 1) {
      throw new Error(`Portal ${tier} needs at least one researcher in seedData.js`);
    }
    await seedPortal(ctx);
  }

  console.log("2b Institutional policies (all RMS modules)...");
  const pol = await seedInstitutionalPolicies(Object.values(users));
  console.log(`     ${pol} policy record(s) upserted (${INSTITUTIONAL_POLICY_CATALOG.length} modules × ${PORTAL_ORDER.length} tiers)`);

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

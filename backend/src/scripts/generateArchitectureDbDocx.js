/**
 * Full current-system Word docs (complete — not draft summaries).
 * node src/scripts/generateArchitectureDbDocx.js
 */
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  BorderStyle,
  PageBreak,
} = require("docx");

const DOCS = path.resolve(__dirname, "../../../docs");
const FIGURES = path.join(DOCS, "figures");

function titleBlock(main, sub) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: main, bold: true, size: 40, color: "0369A1" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: sub, bold: true, size: 22, color: "64748B" })],
    }),
    new Paragraph({
      border: { bottom: { color: "0369A1", space: 1, style: BorderStyle.SINGLE, size: 18 } },
      spacing: { after: 240 },
    }),
  ];
}

function h(text) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: "0C4A6E" })],
  });
}

function h2(text) {
  return new Paragraph({
    spacing: { before: 180, after: 90 },
    children: [new TextRun({ text, bold: true, size: 24, color: "0369A1" })],
  });
}

function p(text) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function b(text) {
  return new Paragraph({
    spacing: { after: 70 },
    indent: { left: 280 },
    children: [new TextRun({ text: `• ${text}`, size: 22 })],
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 200 },
    children: [new TextRun({ text, italics: true, size: 18, color: "64748B" })],
  });
}

function img(fileName, w, h) {
  const full = path.join(FIGURES, fileName);
  if (!fs.existsSync(full)) throw new Error(`Missing figure: ${full}`);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 40 },
    children: [
      new ImageRun({
        type: "png",
        data: fs.readFileSync(full),
        transformation: { width: w, height: h },
        altText: { title: fileName, description: fileName, name: fileName },
      }),
    ],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

async function writeDoc(outName, children) {
  const doc = new Document({
    creator: "Jamhuriya RMS",
    title: outName,
    description: "Complete current JUST RMS documentation",
    sections: [
      {
        properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
        children,
      },
    ],
  });
  const out = path.join(DOCS, outName);
  const tmp = path.join(DOCS, `._${outName}.tmp`);
  fs.writeFileSync(tmp, await Packer.toBuffer(doc));
  try {
    if (fs.existsSync(out)) fs.unlinkSync(out);
  } catch {
    /* locked */
  }
  try {
    fs.renameSync(tmp, out);
    console.log("Written:", out);
  } catch {
    const alt = out.replace(/\.docx$/i, "_CURRENT.docx");
    fs.renameSync(tmp, alt);
    console.log("Target locked; wrote:", alt);
  }
}

function commonUsersSection() {
  return [
    h("Demo users and passwords (after npm run seed)"),
    b("Research Director — director@rms.edu / Director2024! — pick UG or PG"),
    b("Faculty Coordinator — coordinator@rms.edu / Coordinator2024! — pick UG or PG"),
    b("Finance Officer — finance@rms.edu / Finance2024! — pick UG or PG"),
    b("Leadership (peer) — leadership@rms.edu / Leadership2024! — pick UG or PG"),
    b("Researcher UG — asha@rms.edu / Researcher2024! — Undergraduate only"),
    b("Researcher PG — mahad@rms.edu / Researcher2024! — Postgraduate only"),
  ];
}

async function buildArchitecture() {
  await writeDoc("SYSTEM_ARCHITECTURE.docx", [
    ...titleBlock(
      "JUST RMS — Complete System Architecture",
      "Full current system (not a draft) — MERN codebase"
    ),
    p(
      "This document describes the whole Jamhuriya Research Management System as implemented: portals, layers, modules, pages, roles, and the proposal-to-project lifecycle."
    ),

    h("1. System purpose"),
    p(
      "JUST RMS manages university research end-to-end: proposals, ethics (JUREC), peer/committee/finance review, projects, funding calls, grants, budgets, payments, publications, repository, groups, thesis supervision, analytics, notifications, policies, and audit."
    ),
    b("Two portals share one app and one database: Undergraduate (UG) and Postgraduate (PG)."),
    b("Shared staff pick portal after login (X-Program-Tier). Researchers are locked to their programTier."),
    b("After login every role opens Dashboard (/dashboard)."),

    h("2. Architecture diagram"),
    img("arch-current.png", 620, 349),
    caption("Figure 1. Current layered architecture (Frontend / API / MongoDB)"),

    h("3. Technology stack"),
    h2("3.1 Frontend"),
    b("React + Vite + React Router + Axios + Recharts"),
    b("Auth JWT in client; staff send header X-Program-Tier"),
    b("Dev URL: http://localhost:5173 (proxies /api to backend)"),
    h2("3.2 Backend"),
    b("Node.js + Express REST API under /api/..."),
    b("JWT access token + refresh token on User; bcrypt passwords"),
    b("Multer uploads; PDF certificate generation for ethics"),
    b("Middleware: authenticateUser, requireActiveUser, authorizeRoles, programTier scope"),
    b("Dev URL: http://localhost:5000"),
    h2("3.3 Database"),
    b("MongoDB via Mongoose — see DATABASE_STRUCTURE.docx for full schema"),

    h("4. Proposal review flow (Phase 3) — whole path"),
    img("flow-current.png", 620, 349),
    caption("Figure 2. Current multi-stage proposal review"),
    b("1. Researcher submits Voluntary or Grant fund call proposal (+ ethics when required)"),
    b("2. Director: Assign & send to reviewer (Leadership)"),
    b("3. Leadership: peer score 1–5 + comment"),
    b("4. Director: Complete peer stage when all assignees submitted"),
    b("5. Director: Assign & send to committee (Faculty Coordinators)"),
    b("6. Assigned Coordinator: committee recommend/reject/revision"),
    b("7. Grant only — Director: Assign & send to finance"),
    b("8. Grant only — Assigned Finance: approve/reject at /finance/reviews"),
    b("9. When stage = ready_for_director — Director Proposal decision → Approve creates Project"),
    b("Voluntary: finance stage skipped. Ethics certificate does NOT auto-pass committee."),
    b("List chips: Sent to reviewer | Sent to committee | Sent to finance"),

    h("5. Complete module map (UI routes)"),
    h2("5.1 All authenticated users"),
    b("/dashboard — home"),
    b("/profile — profile"),
    b("/notifications — notifications"),
    b("/policies — institutional policies"),
    h2("5.2 Research / proposals / projects"),
    b("/proposals — list; /proposals/new|edit — researcher create/edit"),
    b("/proposals/:id — details; /proposals/:id/review — Director/Coordinator/Leadership review"),
    b("/review-assignments — Director + Leadership peer queue"),
    b("/ethics — ethics applications + JUREC"),
    b("/projects — list; /projects/:id — details; /projects/:id/progress — researcher progress"),
    b("/publications, /repository, /groups, /thesis, /research-workflow"),
    b("/collaboration, /messages"),
    h2("5.3 Funding & finance"),
    b("/funding-calls, /grants, /grants/apply, /grants/:id"),
    b("/budgets, /payments/:id"),
    b("/finance/reviews, /finance/reviews/:id — Finance proposal review"),
    b("/finance/grant-approvals — Finance grant authorization"),
    b("/finance/closures — Finance project closures"),
    b("/finance-reports, /donor-reports — Director/Finance reports"),
    h2("5.4 Director / staff ops"),
    b("/pending-users, /departments — Director"),
    b("/faculty-dashboard — Coordinator"),
    b("/kpi-dashboard, /system-reports, /audit-trail, /search"),
    b("/program-tier — portal picker for shared staff"),

    h("6. Complete API surface (app.js)"),
    b("/api/auth — login, refresh, me"),
    b("/api/users — user admin / pending"),
    b("/api/proposals — CRUD, submit, assign-reviewers, assign-committee, assign-finance, peer/committee/finance review, director decision"),
    b("/api/ethics — applications, director decision, certificate PDF"),
    b("/api/projects — projects, progress, closure"),
    b("/api/funding-calls, /api/grants, /api/budgets, /api/payments, /api/procurement"),
    b("/api/publications, /api/repository (+ public OAI-PMH)"),
    b("/api/groups, /api/thesis-groups, /api/departments"),
    b("/api/analytics, /api/notifications, /api/conversations"),
    b("/api/policies, /api/search, /api/audit"),
    b("/api/health — health check"),

    h("7. Roles and responsibilities (complete)"),
    b("research_director — assign peer/committee/finance; ethics certificate; final approve; users; funding calls; oversight reports"),
    b("faculty_coordinator — committee review when assigned; faculty dashboard"),
    b("leadership — peer review when assigned; peer assignments queue"),
    b("finance_officer — grant proposal finance review; grant authorization; budgets/payments; project closure finance"),
    b("researcher — proposals, ethics, projects, publications, grants apply, repository"),
    ...commonUsersSection(),

    h("8. Security and scoping"),
    b("JWT Bearer required on protected routes"),
    b("authorizeRoles on sensitive endpoints (peer/committee/finance assign & decide)"),
    b("programTier filter on business documents"),
    b("Assign-first gates: committee/finance cannot decide without assignment"),
    b("Director final approve blocked until multi-stage ready_for_director"),

    h("9. Run and deploy"),
    b("Local: backend npm run dev + frontend npm run dev; seed with npm run seed"),
    b("Production option: Render Blueprint (render.yaml) + MongoDB Atlas"),
    b("Related Word: DATABASE_STRUCTURE.docx (full schema), SYSTEM_HOW_IT_WORKS.docx (user guide)"),
  ]);
}

async function buildDatabase() {
  await writeDoc("DATABASE_STRUCTURE.docx", [
    ...titleBlock(
      "JUST RMS — Complete Database Structure",
      "All MongoDB models in backend/src/models (current)"
    ),
    p(
      "This document lists every collection used by the live system, key fields, statuses, and relationships. It is the full schema guide — not a short draft."
    ),

    h("1. Entity relationship diagram"),
    img("db-current.png", 620, 349),
    caption("Figure 1. Current database relationships"),

    h("2. Lifecycle overview"),
    img("flow-current.png", 620, 349),
    caption("Figure 2. Proposal review flow that drives proposal/project status fields"),
    p(
      "User (researcher) → Proposal (+ EthicsApplication) → (optional FundingCall) → on Approve → Project → Grant/Budget/Payment/PurchaseOrder → Publication/RepositoryItem. Supporting: ResearchGroup, ThesisGroup, Department, Conversation, Notification, InstitutionalPolicy, AuditEvent."
    ),

    h("3. Collection: users"),
    b("Fields: fullName, email (unique), password, role, department, rank, researchInterests, status, programTier, isProtected, refreshToken"),
    b("Roles: research_director, faculty_coordinator, finance_officer, leadership, researcher (+ legacy enums may exist)"),
    b("Status: pending | active | rejected"),

    h("4. Collection: proposals"),
    b("Relations: researcherId → users; ethicsApplicationId → ethicsapplications; fundingCallId → fundingcalls"),
    b("Assignees: assignedReviewers[], assignedCommittee[], assignedFinance[] (userId, assignedBy, assignedAt)"),
    b("Fields: title, abstract, department, researchArea, document, version/versionHistory, budgetBreakdown, peerReviews, reviewPipeline, reviewerComments, proposalKind, ethicsStatus, programTier"),
    b("Status: draft | submitted | under_review | approved | rejected | revision_requested"),
    b("proposalKind: voluntary | grant_fund_call"),
    b("ethicsStatus: not_required | pending | approved | rejected | revision_requested"),
    b("reviewPipeline stages: adminScreening, peerReview, committeeReview, financeReview — each pending|in_progress|passed|failed|skipped"),

    h("5. Collection: ethicsapplications"),
    b("Relations: proposalId (unique sparse 1:1), researcherId"),
    b("Fields: applicant persons, project narrative, risk/consent/privacy, approval (refNumber, certificate meta, signedByUserId)"),
    b("Status: draft | submitted | approved | rejected"),

    h("6. Collection: projects"),
    b("Relations: proposalId, researcherId; team/progress/closure actor refs"),
    b("Fields: title, milestones, workPlan, activities, communicationLog, closure checklist + reports"),
    b("Status: active | completed | on_hold | closing | closed"),
    b("Closure: none | submitted | director_approved | finance_approved | archived"),

    h("7. Collection: fundingcalls"),
    b("Relations: createdBy → users"),
    b("Fields: title, fundingSource, amountCap, currency, deadline, eligibilityTier, docs"),
    b("Status: draft | open | closed; callType: internal | external"),

    h("8. Collection: grants"),
    b("Relations: researcherId, projectId, proposalId, callId, financeApprovedBy"),
    b("Fields: title, amounts, currency, budget breakdown, requirement checklist"),
    b("Status: draft | submitted | approved | pending_finance | rejected | active | closed"),

    h("9. Collection: budgets"),
    b("Relations: grantId, projectId, ownerResearcherId; item createdBy/approvedBy"),
    b("Fields: totalAllocated, totalDisbursed, currency, items[]"),
    b("Item type: expense | procurement; item status: pending | approved | paid | rejected"),

    h("10. Collection: payments"),
    b("Relations: budgetId; requestedBy / approvers / paidBy; optional projectId, grantId"),
    b("Status: requested | director_approved | paid | rejected"),
    b("Category: RA / equipment / travel / publication_fee / other"),

    h("11. Collection: purchaseorders"),
    b("Relations: budgetId; optional projectId, grantId; request/approve/pay actors"),
    b("Status: requested | procurement_approved | director_approved | paid | rejected"),

    h("12. Collection: publications"),
    b("Relations: researcherId; projectId (unique sparse — at most one publication per project)"),
    b("Status: draft | submitted | revision_requested | validated | rejected"),
    b("workflowStage: submitted | in_process | pipeline | published"),

    h("13. Collection: repositoryitems"),
    b("Relations: uploadedBy; optional groupId, projectId"),
    b("type: dataset | publication | thesis | document"),
    b("access: private | group | institution"),

    h("14. Collection: departments"),
    b("Fields: name, code, faculty, programTier, createdBy"),
    b("Unique: (name+programTier), (code+programTier)"),

    h("15. Collection: researchgroups"),
    b("Relations: departmentId; members[].userId; createdBy"),
    b("kind: collaboration | thesis; member role: lead | member"),

    h("16. Collection: thesisgroups"),
    b("Relations: researchGroupId; supervisorId; coordinatorId; chapter/meeting actors"),
    b("Fields: students[], chapters[], titleProposal, meetings, finalDocument"),
    b("Status: proposed | in_progress | submitted | defended | completed"),

    h("17. Collection: conversations"),
    b("Relations: participants[] → users; messages[].senderId; optional groupId"),

    h("18. Collection: notifications"),
    b("Relations: userId → users"),
    b("type: proposal | project | grant | budget | publication | repository | ethics | message | system"),

    h("19. Collection: institutionalpolicies"),
    b("Relations: updatedBy"),
    b("Unique (programTier + moduleKey); status: draft | published"),

    h("20. Collection: auditevents"),
    b("Relations: actorId; polymorphic entityType + entityId"),
    b("Fields: action, label, detail, metadata, programTier"),

    h("21. Indexing and portal rules"),
    b("programTier on nearly all business documents for UG/PG isolation"),
    b("Shared staff one account — switch portal with X-Program-Tier"),
    b("Researchers filtered to own programTier only"),
    b("Assign-first and stage gates enforced in controllers (not only enums)"),

    ...commonUsersSection(),
    p("Related Word: SYSTEM_ARCHITECTURE.docx (full architecture + modules + APIs)."),
  ]);
}

async function buildHowItWorksComplete() {
  await writeDoc("SYSTEM_HOW_IT_WORKS.docx", [
    ...titleBlock(
      "JUST RMS — How the Full System Works",
      "Complete current user guide (UG + PG)"
    ),
    p("This is the full how-to for the running system. Use with SYSTEM_ARCHITECTURE.docx and DATABASE_STRUCTURE.docx."),
    ...commonUsersSection(),
    h("1. Login and portals"),
    b("Open frontend → login with email/password"),
    b("Staff (Director, Coordinator, Finance, Leadership): choose Undergraduate or Postgraduate"),
    b("Researchers: automatic portal from account"),
    b("Landing page for everyone: Dashboard"),
    h("2. Researcher path"),
    b("Create Voluntary or Grant fund call proposal (+ ethics if required) → submit"),
    b("Wait for peer → committee → (grant) finance → Director approve"),
    b("When approved, Project appears — milestones, progress, publications, repository"),
    h("3. Director path"),
    b("Assign & send to reviewer → wait Leadership scores → Complete peer stage"),
    b("Assign & send to committee → wait Coordinator decision"),
    b("Grant: Assign & send to finance → wait Finance"),
    b("Approve ethics / issue JUREC certificate when ready (separate from committee)"),
    b("When multi-stage complete: Proposal decision → Approve (creates project)"),
    h("4. Leadership / Coordinator / Finance"),
    b("Leadership: Peer Reviews / assignments — score only assigned proposals"),
    b("Coordinator: committee decide only if assigned"),
    b("Finance: /finance/reviews for grant proposals after committee; also budgets, grant approvals, closures"),
    h("5. Review flow diagram"),
    img("flow-current.png", 620, 349),
    caption("Figure 1. Full current proposal review flow"),
    h("6. Architecture reminder"),
    img("arch-current.png", 620, 349),
    caption("Figure 2. System layers"),
    h("7. Database reminder"),
    img("db-current.png", 620, 349),
    caption("Figure 3. Main database relationships"),
    h("8. Run locally"),
    b("cd backend && npm install && npm run seed && npm run dev"),
    b("cd frontend && npm install && npm run dev"),
  ]);
}

async function main() {
  for (const f of ["arch-current.png", "db-current.png", "flow-current.png"]) {
    if (!fs.existsSync(path.join(FIGURES, f))) {
      console.error("Missing", path.join(FIGURES, f));
      process.exit(1);
    }
  }
  await buildArchitecture();
  await buildDatabase();
  await buildHowItWorksComplete();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

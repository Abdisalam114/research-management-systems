/**
 * Generates docs/SYSTEM_DOCUMENTATION.pdf — full Jamhuriya RMS guide.
 * Run: node src/scripts/generateSystemDocsPdf.js
 */
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const OUT_PATH = path.resolve(__dirname, "../../../docs/SYSTEM_DOCUMENTATION.pdf");

const COLORS = {
  title: "#0f172a",
  heading: "#0369a1",
  subheading: "#334155",
  muted: "#64748b",
  line: "#cbd5e1",
};

const ROLES = [
  ["Research Director", "research_director", "Institutional oversight, ethics review/approval, grants, user management, departments, analytics"],
  ["Faculty Coordinator", "faculty_coordinator", "Faculty proposal pre-review, publication validation, faculty reports, audit trail"],
  ["Finance Officer", "finance_officer", "Budgets, payment disbursement, finance reports, donor reports, closure finance approval"],
  ["University Leadership", "leadership", "Peer review assignments, funding call approval, KPIs, institutional policies"],
  ["Procurement Officer", "procurement_officer", "Purchase order review before director (/budgets queue)"],
  ["Researcher", "researcher", "Proposals (budget, compliance docs), ethics forms, projects, publications, groups, repository uploads"],
];

const FRONTEND_PAGES = [
  ["/dashboard", "Dashboard & Analytics", "All roles — role-specific widgets"],
  ["/ethics", "Ethics (REC)", "Director, Coordinator, Researcher"],
  ["/proposals", "Proposals", "Director, Coordinator, Researcher"],
  ["/proposals/new", "New Proposal + budget + compliance docs + Ethics", "Researcher only"],
  ["/proposals/:id/review", "Director/Coordinator Review", "Director, Coordinator"],
  ["/projects", "Projects", "Director, Coordinator, Researcher"],
  ["/projects/:id", "Project Details — work plan, activities, comm log, closure", "Director, Coordinator, Researcher"],
  ["/publications", "Publications & Outputs", "Director, Coordinator, Researcher"],
  ["/research-workflow", "Research Workflow", "Director, Coordinator, Researcher"],
  ["/thesis", "Thesis Groups (min 4 students)", "Director, Coordinator, Researcher"],
  ["/funding-calls", "Funding Calls", "Director, Coordinator, Finance, Researcher"],
  ["/grants", "Grants", "Director, Coordinator, Finance, Researcher"],
  ["/budgets", "Finance & Budgets + Procurement PO queue", "Director, Finance, Researcher, Procurement Officer"],
  ["/finance-reports", "Finance Reports", "Director, Finance"],
  ["/donor-reports", "Donor Reports", "Director, Finance"],
  ["/audit-trail", "Audit Trail", "Director, Coordinator"],
  ["/repository", "Repository", "Director, Coordinator, Researcher"],
  ["/collaboration", "Collaboration Hub", "All authenticated roles"],
  ["/groups", "Research Groups", "Director, Coordinator, Researcher"],
  ["/messages", "Messages", "All authenticated roles"],
  ["/notifications", "Notifications", "All authenticated roles"],
  ["/pending-users", "User Approval", "Director only"],
  ["/departments", "Departments CRUD", "Director only"],
  ["/profile", "Profile", "All roles"],
];

const API_MODULES = [
  {
    prefix: "/api/auth",
    endpoints: [
      "POST /register — self-registration (pending approval)",
      "POST /login — JWT access + refresh cookie",
      "POST /logout — clear session",
      "POST /refresh — renew access token",
      "GET /me — current user profile",
    ],
  },
  {
    prefix: "/api/users",
    endpoints: [
      "GET / — list users (director)",
      "GET /pending — pending registrations (director)",
      "POST /:id/approve | /:id/reject — user approval",
      "PUT /me — update own profile",
    ],
  },
  {
    prefix: "/api/proposals",
    endpoints: [
      "GET / — list proposals (role-filtered)",
      "POST / — create proposal (researcher, multipart document)",
      "PUT /:id — update draft/revision (researcher)",
      "POST /:id/submit — submit proposal + linked ethics to director",
      "POST /:id/review — coordinator recommendation",
      "POST /:id/director-decision — approve/reject (creates project on approve)",
      "GET /:id/ethics-application — linked ethics form",
    ],
  },
  {
    prefix: "/api/ethics",
    endpoints: [
      "GET / — list ethics applications",
      "POST / — create standalone ethics application",
      "PATCH /:id — save draft",
      "POST /:id/submit — submit to REC",
      "POST /:id/director-decision — approve/reject + issue certificate",
      "GET /:id/certificate.pdf — download ethics certificate",
    ],
  },
  {
    prefix: "/api/projects",
    endpoints: [
      "GET / — list projects",
      "GET /:id — project details with PI",
      "PUT /:id — update project (director/researcher)",
      "POST /:id/progress — add progress report (researcher)",
    ],
  },
  {
    prefix: "/api/publications",
    endpoints: [
      "GET / — list publications",
      "POST / — create publication (researcher)",
      "PUT /:id — update draft",
      "POST /:id/submit — submit for validation",
      "POST /:id/validate | /:id/reject — coordinator/director validation",
      "GET /citation?doi= — CrossRef DOI lookup",
    ],
  },
  {
    prefix: "/api/grants",
    endpoints: [
      "GET / — list grants",
      "POST / — create grant request (researcher)",
      "PUT /:id — update grant",
      "POST /:id/submit — submit for review",
      "POST /:id/director-decision — approve with awarded amount",
    ],
  },
  {
    prefix: "/api/budgets",
    endpoints: [
      "GET / — list budgets",
      "POST / — create budget (director/finance)",
      "POST /:id/items — add budget line item",
      "PATCH /:id/items/:itemId — approve/reject/pay item",
    ],
  },
  {
    prefix: "/api/payments",
    endpoints: [
      "GET / — list payment requests",
      "POST / — create payment request",
      "POST /:id/director-decision — director approve/reject",
      "POST /:id/finance-pay — finance marks as paid",
    ],
  },
  {
    prefix: "/api/procurement",
    endpoints: [
      "GET / — list purchase orders",
      "POST / — create PO",
      "POST /:id/director-decision — director approve/reject",
      "POST /:id/finance-pay — finance marks as paid",
    ],
  },
  {
    prefix: "/api/repository",
    endpoints: [
      "GET / — list repository items",
      "POST / — upload file (PDF/CSV/Excel only)",
      "GET /export/csv | /export/pdf | /export/excel — catalog export",
      "GET /oai — OAI-PMH 2.0 (public, app-level route)",
      "GET /oai/export — OAI bulk export",
    ],
  },
  {
    prefix: "/api/groups",
    endpoints: [
      "GET / — list research groups",
      "GET /stats — collaboration vs thesis counts",
      "POST / — create group",
      "POST /:id/join | /:id/leave — membership",
      "DELETE /:id — delete group (director)",
    ],
  },
  {
    prefix: "/api/thesis-groups",
    endpoints: [
      "GET / — list thesis groups",
      "POST / — create thesis group",
      "PATCH /:id — update group",
      "POST /:id/meetings — log supervision meeting",
      "DELETE /:id — delete (director)",
    ],
  },
  {
    prefix: "/api/conversations",
    endpoints: [
      "GET / — list my conversations",
      "GET /users — messageable users list",
      "POST / — start 1:1 conversation",
      "GET /group/:groupId — open group chat",
      "POST /:id/messages — send message (+ notification)",
    ],
  },
  {
    prefix: "/api/notifications",
    endpoints: [
      "GET /me — my notifications",
      "GET /me/unread-count — badge count",
      "POST /:id/read — mark as read",
    ],
  },
  {
    prefix: "/api/analytics",
    endpoints: [
      "GET /dashboard — role-based dashboard metrics",
      "GET /institutional — director institutional analytics",
      "GET /faculty-report — coordinator faculty report",
      "GET /faculty-report.pdf — faculty report PDF export",
      "GET /finance-report — finance summary",
      "GET /annual-report.pdf — director annual report PDF",
    ],
  },
  {
    prefix: "/api/departments",
    endpoints: [
      "GET / — list departments",
      "POST / — create (director)",
      "PUT /:id — update (director)",
      "DELETE /:id — delete (director)",
    ],
  },
];

const WORKFLOWS = [
  {
    title: "A. Proposal + Ethics (Researcher → Director)",
    steps: [
      "Researcher creates Proposal + Ethics form on one page (/proposals/new).",
      "System auto-fills ethics from profile and proposal fields.",
      "Researcher saves draft or submits both to Director in one action.",
      "Director reviews ethics certificate + proposal on /proposals/:id/review.",
      "On approval: Project is created automatically; notifications sent.",
    ],
  },
  {
    title: "B. Publications (Researcher → Coordinator/Director)",
    steps: [
      "Researcher creates publication record (draft).",
      "Submits for validation; appears in faculty workflow pipeline.",
      "Coordinator or Director validates or rejects.",
      "Validated publications count toward faculty analytics.",
    ],
  },
  {
    title: "C. Finance (Researcher → Director → Finance)",
    steps: [
      "Grant approved with awarded amount → Budget created.",
      "Researcher requests Payment or Purchase Order against budget.",
      "Director approves request.",
      "Finance Officer marks payment as paid / disbursed.",
    ],
  },
  {
    title: "D. Collaboration & Messaging",
    steps: [
      "Users create or join Research Groups (/groups).",
      "Group chat opens via Conversation linked to groupId.",
      "Direct 1:1 messaging via /messages with user picker.",
      "Each message triggers a Notification for recipients.",
    ],
  },
  {
    title: "E. Thesis Supervision",
    steps: [
      "Coordinator/Director creates Thesis Group with students + supervisor.",
      "Optional link to ResearchGroup for chat.",
      "Supervisor logs meetings (date, location, agenda, notes).",
      "Status tracked: proposed → in_progress → submitted → defended → completed.",
    ],
  },
];

const COLLECTIONS_BRIEF = [
  "users", "departments", "proposals", "ethicsapplications", "projects",
  "publications", "grants", "budgets", "payments", "purchaseorders",
  "researchgroups", "thesisgroups", "conversations", "notifications", "repositoryitems",
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function checkPageBreak(doc, needed = 80) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    doc.y = doc.page.margins.top;
  }
}

function sectionTitle(doc, text) {
  checkPageBreak(doc, 40);
  doc.fillColor(COLORS.heading).fontSize(14).font("Helvetica-Bold").text(text);
  doc.moveDown(0.4);
  doc.fillColor(COLORS.title);
}

function bodyText(doc, text, opts = {}) {
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.subheading).text(text, opts);
  doc.moveDown(0.25);
}

function bullet(doc, text) {
  checkPageBreak(doc, 20);
  bodyText(doc, `• ${text}`);
}

function drawHr(doc) {
  const y = doc.y;
  doc.strokeColor(COLORS.line).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
  doc.moveDown(0.6);
}

function renderTable(doc, rows, colWidths) {
  const startX = doc.page.margins.left;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const rowHeight = 16;

  rows.forEach((row, idx) => {
    checkPageBreak(doc, rowHeight + 4);
    const y = doc.y;
    const isHeader = idx === 0;
    doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(isHeader ? 9 : 8.5);
    doc.fillColor(isHeader ? COLORS.heading : COLORS.subheading);

    let x = startX;
    row.forEach((cell, colIdx) => {
      doc.text(String(cell || ""), x, y, { width: colWidths[colIdx], lineGap: 0.5 });
      x += colWidths[colIdx];
    });
    doc.y = y + rowHeight;
    if (isHeader) {
      doc.strokeColor(COLORS.line).moveTo(startX, doc.y).lineTo(startX + totalW, doc.y).stroke();
      doc.moveDown(0.15);
    }
  });
  doc.moveDown(0.4);
}

async function generatePdf() {
  ensureDir(path.dirname(OUT_PATH));

  const doc = new PDFDocument({ size: "A4", margin: 54, bufferPages: true });
  const stream = fs.createWriteStream(OUT_PATH);
  doc.pipe(stream);

  const generatedAt = new Date().toLocaleString();
  const contentW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Cover
  doc.fillColor(COLORS.title).font("Helvetica-Bold").fontSize(26).text("Jamhuriya RMS", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(20).fillColor(COLORS.heading).text("System Documentation", { align: "center" });
  doc.moveDown(1);
  doc.font("Helvetica").fontSize(12).fillColor(COLORS.muted).text("Research Management System — Full Guide", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).text("Jamhuriya University of Science & Technology", { align: "center" });
  doc.moveDown(2);
  doc.text(`Generated: ${generatedAt}`, { align: "center" });
  doc.text("Stack: MERN (MongoDB, Express, React, Node.js)", { align: "center" });
  doc.text("See also: docs/DATABASE_STRUCTURE.pdf", { align: "center" });

  doc.addPage();

  // 1. Overview
  sectionTitle(doc, "1. System Overview");
  bodyText(doc, "Jamhuriya RMS is a web-based research management platform covering the full research lifecycle: proposal submission, ethics review (REC), project tracking, grants and budgets, publications, institutional repository, collaboration, and analytics.");
  bodyText(doc, "Architecture: React SPA (Vite) → Express REST API → MongoDB. JWT authentication with HTTP-only refresh cookies. Role-based access control (RBAC) on both frontend routes and backend endpoints.");
  drawHr(doc);

  // 2. Stack
  sectionTitle(doc, "2. Technology Stack");
  renderTable(doc, [
    ["Layer", "Technology", "Notes"],
    ["Frontend", "React 19 + Vite", "Port 5173, proxies /api to backend"],
    ["Backend", "Express 5 + Node.js", "Port 5000"],
    ["Database", "MongoDB + Mongoose", "Database: rms"],
    ["Auth", "JWT + bcrypt", "Access token + refresh cookie"],
    ["Charts", "Recharts", "Dashboard analytics"],
    ["PDF", "PDFKit", "Reports, ethics certificates, exports"],
    ["Files", "Multer", "Proposal docs, repository uploads"],
  ], [90, 120, contentW - 210]);
  drawHr(doc);

  // 3. Roles
  sectionTitle(doc, "3. User Roles");
  renderTable(doc, [["Role", "Code", "Responsibilities"], ...ROLES], [100, 110, contentW - 210]);
  drawHr(doc);

  // 4. Frontend
  sectionTitle(doc, "4. Frontend Pages");
  renderTable(doc, [["Route", "Page", "Access"], ...FRONTEND_PAGES], [110, 130, contentW - 240]);
  drawHr(doc);

  // 5. API
  sectionTitle(doc, "5. REST API Endpoints");
  bodyText(doc, "Base URL: http://localhost:5000. All routes except /api/auth/register, /api/auth/login, /api/health, and /api/repository/oai require authentication.");
  API_MODULES.forEach((mod) => {
    checkPageBreak(doc, 60);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.heading).text(mod.prefix);
    doc.moveDown(0.2);
    mod.endpoints.forEach((ep) => bullet(doc, ep));
    doc.moveDown(0.3);
  });
  drawHr(doc);

  // 6. Workflows
  sectionTitle(doc, "6. Key Workflows");
  WORKFLOWS.forEach((wf) => {
    checkPageBreak(doc, 80);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.subheading).text(wf.title);
    doc.moveDown(0.2);
    wf.steps.forEach((step, i) => bodyText(doc, `${i + 1}. ${step}`));
    doc.moveDown(0.4);
  });
  drawHr(doc);

  // 7. Database summary
  sectionTitle(doc, "7. Database (MongoDB)");
  bodyText(doc, `Database name: rms | URI: mongodb://localhost:27017/rms | Collections (${COLLECTIONS_BRIEF.length}):`);
  bodyText(doc, COLLECTIONS_BRIEF.join(", "));
  bodyText(doc, "Full field-level documentation: docs/DATABASE_STRUCTURE.pdf (generate with npm run docs:database-pdf).");
  drawHr(doc);

  // 8. Bootstrap
  sectionTitle(doc, "8. Initial User Bootstrap");
  bodyText(doc, "Run npm run seed once to create institutional accounts (director, coordinators, finance officers, researchers).");
  bodyText(doc, "Configure credentials via SEED_* variables in backend/.env or edit src/scripts/seedData.js.");
  bodyText(doc, "The seed command does not create fictional proposals, grants, or publications.");
  drawHr(doc);

  // 9. Setup
  sectionTitle(doc, "9. Setup & Run");
  bodyText(doc, "Prerequisites: Node.js 18+, MongoDB running locally.");
  bodyText(doc, "Backend: cd backend → cp .env.example .env → npm install → npm run seed → npm run dev");
  bodyText(doc, "Frontend: cd frontend → npm install → npm run dev");
  bodyText(doc, "App URL: http://localhost:5173 | API: http://localhost:5000/api/health");
  drawHr(doc);

  // 10. Exports
  sectionTitle(doc, "10. Export Features");
  bullet(doc, "Repository catalog: PDF, Excel, CSV (/repository page buttons)");
  bullet(doc, "Ethics certificate: PDF per approved application");
  bullet(doc, "Faculty research report: PDF for coordinators");
  bullet(doc, "Annual institutional report: PDF for director");
  bullet(doc, "OAI-PMH 2.0: /api/repository/oai (institutional repository integration)");

  // Page numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted);
    doc.text(`Jamhuriya RMS — System Documentation | Page ${i + 1} of ${range.count}`, 54, doc.page.height - 36, {
      align: "center",
      width: doc.page.width - 108,
    });
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  const stats = fs.statSync(OUT_PATH);
  console.log(`PDF written: ${OUT_PATH}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
}

generatePdf().catch((err) => {
  console.error(err);
  process.exit(1);
});

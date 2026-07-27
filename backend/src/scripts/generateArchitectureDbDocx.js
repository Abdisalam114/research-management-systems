/**
 * Current-system-only Word docs (no legacy diagrams).
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
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: "0C4A6E" })],
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

async function writeDoc(outName, children) {
  const doc = new Document({
    creator: "Jamhuriya RMS",
    title: outName,
    description: "Current JUST RMS documentation",
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

async function buildArchitecture() {
  await writeDoc("SYSTEM_ARCHITECTURE.docx", [
    ...titleBlock(
      "JUST RMS — System Architecture (Current)",
      "Based on the running MERN application — July 2026 codebase"
    ),
    h("1. Architecture diagram (current)"),
    p(
      "Three layers: React/Vite SPA, Express REST API with JWT and X-Program-Tier, MongoDB. Shared staff pick Undergraduate or Postgraduate portal after login."
    ),
    img("arch-current.png", 620, 349),
    caption("Figure 1. Current JUST RMS layered architecture"),
    h("2. Technology stack (as built)"),
    b("Frontend: React + Vite + React Router + Axios + Recharts"),
    b("Backend: Node.js + Express + Mongoose + JWT + bcrypt + Multer"),
    b("Database: MongoDB"),
    b("Portals: undergraduate | postgraduate (header X-Program-Tier for shared staff)"),
    h("3. Current proposal review flow"),
    p(
      "Assign-first Phase 3: Director assigns Leadership for peer review, then Faculty Coordinator for committee, then Finance for grant proposals only. Final Approve creates a Project. Voluntary proposals skip finance. Ethics (JUREC) is separate from faculty committee."
    ),
    img("flow-current.png", 620, 349),
    caption("Figure 2. Current proposal multi-stage review flow"),
    h("4. Active roles (seed)"),
    b("research_director — director@rms.edu"),
    b("faculty_coordinator — coordinator@rms.edu"),
    b("leadership — leadership@rms.edu (peer review)"),
    b("finance_officer — finance@rms.edu"),
    b("researcher — asha@rms.edu (UG), mahad@rms.edu (PG)"),
    h("5. API modules mounted in app.js (current)"),
    b("/api/auth, /api/users, /api/proposals, /api/ethics, /api/projects"),
    b("/api/funding-calls, /api/grants, /api/budgets, /api/payments, /api/procurement"),
    b("/api/publications, /api/repository, /api/groups, /api/thesis-groups"),
    b("/api/departments, /api/analytics, /api/notifications, /api/conversations"),
    b("/api/policies, /api/search, /api/audit"),
    h("6. Local run"),
    b("Backend: cd backend && npm run dev → http://localhost:5000"),
    b("Frontend: cd frontend && npm run dev → http://localhost:5173"),
    b("After login all roles land on /dashboard"),
  ]);
}

async function buildDatabase() {
  await writeDoc("DATABASE_STRUCTURE.docx", [
    ...titleBlock(
      "JUST RMS — Database Structure (Current)",
      "MongoDB models in backend/src/models — current schema"
    ),
    h("1. Relationship diagram (current)"),
    p(
      "User → Proposal ↔ EthicsApplication; Proposal may link FundingCall; on approve → Project → Grant/Budget/Payment/PurchaseOrder/Publication/RepositoryItem; User also links ResearchGroup and ThesisGroup."
    ),
    img("db-current.png", 620, 349),
    caption("Figure 1. Current database relationships"),
    h("2. Collections (18 models)"),
    b("users — role, programTier, status, refreshToken"),
    b("proposals — proposalKind, reviewPipeline, assignedReviewers, assignedCommittee, assignedFinance"),
    b("ethicsapplications — 1:1 proposalId, approval certificate meta"),
    b("projects — proposalId, closure workflow"),
    b("fundingcalls — open/closed calls, amountCap"),
    b("grants — callId, proposalId, projectId, finance status"),
    b("budgets — grantId/projectId, items[]"),
    b("payments — budgetId, approval/pay actors"),
    b("purchaseorders — procurement path"),
    b("publications — projectId unique sparse (≤1 per project)"),
    b("repositoryitems — project/group access"),
    b("departments, researchgroups, thesisgroups"),
    b("conversations, notifications, institutionalpolicies, auditevents"),
    h("3. Proposal review fields (current)"),
    b("assignedReviewers[] — Leadership peer assignees"),
    b("assignedCommittee[] — Faculty Coordinator assignees"),
    b("assignedFinance[] — Finance Officer assignees (grant only)"),
    b("reviewPipeline: peerReview, committeeReview, financeReview (+ adminScreening auto-passed on assign)"),
    b("proposalKind: voluntary | grant_fund_call"),
    h("4. programTier scoping"),
    p(
      "Almost every business document stores programTier. Researchers are locked to their tier. Shared staff switch portal via X-Program-Tier without separate UG/PG accounts."
    ),
    h("5. Review flow reminder"),
    img("flow-current.png", 620, 349),
    caption("Figure 2. Current review flow (same as architecture doc)"),
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

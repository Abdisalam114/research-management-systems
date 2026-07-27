/**
 * Build SYSTEM_ARCHITECTURE.docx and DATABASE_STRUCTURE.docx with embedded diagrams.
 * Run: node src/scripts/generateArchitectureDbDocx.js
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
  HeadingLevel,
  BorderStyle,
} = require("docx");

const DOCS = path.resolve(__dirname, "../../../docs");
const FIGURES = path.join(DOCS, "figures");

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, bold: true, color: "0C4A6E" })],
  });
}

function body(text) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: 360 },
    children: [new TextRun({ text: `• ${text}`, size: 22 })],
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 240 },
    children: [new TextRun({ text, italics: true, size: 18, color: "64748B" })],
  });
}

function titleBlock(main, sub) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: main, bold: true, size: 40, color: "0369A1" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: sub, bold: true, size: 24, color: "64748B" })],
    }),
    new Paragraph({
      border: { bottom: { color: "0369A1", space: 1, style: BorderStyle.SINGLE, size: 18 } },
      spacing: { after: 280 },
    }),
  ];
}

function imageParagraph(fileName, widthPx, heightPx) {
  const full = path.join(FIGURES, fileName);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing figure: ${full}`);
  }
  const data = fs.readFileSync(full);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 40 },
    children: [
      new ImageRun({
        type: "png",
        data,
        transformation: { width: widthPx, height: heightPx },
        altText: { title: fileName, description: fileName, name: fileName },
      }),
    ],
  });
}

function optionalRepoImage(relName, widthPx, heightPx) {
  const full = path.join(DOCS, relName);
  if (!fs.existsSync(full)) return [];
  const data = fs.readFileSync(full);
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      children: [
        new ImageRun({
          type: "png",
          data,
          transformation: { width: widthPx, height: heightPx },
          altText: { title: relName, description: relName, name: relName },
        }),
      ],
    }),
  ];
}

async function writeDoc(outName, children) {
  const doc = new Document({
    creator: "Jamhuriya RMS",
    title: outName,
    description: "JUST RMS documentation with diagrams",
    sections: [
      {
        properties: {
          page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } },
        },
        children,
      },
    ],
  });
  const out = path.join(DOCS, outName);
  const tmp = `${out}.tmp.docx`;
  fs.writeFileSync(tmp, await Packer.toBuffer(doc));
  try {
    fs.renameSync(tmp, out);
  } catch {
    // Target may be open in Word — keep a diagrams copy
    const alt = out.replace(/\.docx$/i, "_WITH_FIGURES.docx");
    fs.renameSync(tmp, alt);
    console.log("Target locked; wrote:", alt);
    return;
  }
  console.log("Written:", out);
}

async function buildArchitecture() {
  const children = [
    ...titleBlock(
      "JUST RMS — System Architecture",
      "Jamhuriya University of Science & Technology"
    ),
    heading("1. Layered architecture (with diagram)"),
    body(
      "The system is a MERN stack: React (Vite) frontend, Express API, MongoDB. Staff portals use header X-Program-Tier (undergraduate | postgraduate)."
    ),
    imageParagraph("arch-layers.png", 620, 349),
    caption("Figure 1. JUST RMS layered system architecture"),
    heading("2. Stack"),
    bullet("Frontend: React + Vite + React Router + Axios + Recharts"),
    bullet("Backend: Node.js + Express + JWT (bcrypt) + Multer uploads"),
    bullet("Database: MongoDB (Mongoose)"),
    bullet("Auth: Bearer access token; researchers locked to programTier"),
    heading("3. Main API groups"),
    bullet("/api/auth, /api/users, /api/proposals, /api/ethics, /api/projects"),
    bullet("/api/funding-calls, /api/grants, /api/budgets, /api/payments, /api/procurement"),
    bullet("/api/publications, /api/repository, /api/groups, /api/thesis-groups"),
    bullet("/api/analytics, /api/notifications, /api/audit"),
    heading("4. Proposal review pipeline"),
    body(
      "Assign peer → Peer review → Assign committee → Committee → (Grant) Assign finance → Finance → Director Approve → Project."
    ),
    body("Voluntary proposals skip finance. Ethics certificate is separate from faculty committee."),
    heading("5. Additional system diagrams"),
    ...optionalRepoImage("JUST-RMS-Architecture.png", 580, 360),
    ...(fs.existsSync(path.join(DOCS, "JUST-RMS-Architecture.png"))
      ? [caption("Figure 2. JUST RMS architecture overview")]
      : []),
    ...optionalRepoImage("JUST-RMS-System-Diagram.png", 580, 360),
    ...(fs.existsSync(path.join(DOCS, "JUST-RMS-System-Diagram.png"))
      ? [caption("Figure 3. JUST RMS system diagram")]
      : []),
    ...optionalRepoImage("JUST-RMS-Internal-Architecture.png", 580, 360),
    ...(fs.existsSync(path.join(DOCS, "JUST-RMS-Internal-Architecture.png"))
      ? [caption("Figure 4. Internal architecture")]
      : []),
    ...optionalRepoImage("JUST-RMS-Connections-Diagram.png", 580, 360),
    ...(fs.existsSync(path.join(DOCS, "JUST-RMS-Connections-Diagram.png"))
      ? [caption("Figure 5. Module connections")]
      : []),
    ...optionalRepoImage("JUST-RMS-All-Modules.png", 580, 360),
    ...(fs.existsSync(path.join(DOCS, "JUST-RMS-All-Modules.png"))
      ? [caption("Figure 6. All modules")]
      : []),
  ];
  await writeDoc("SYSTEM_ARCHITECTURE.docx", children);
}

async function buildDatabase() {
  const children = [
    ...titleBlock(
      "JUST RMS — Database Structure",
      "MongoDB collections, fields, and relationships"
    ),
    heading("1. Entity relationship diagram"),
    body(
      "Core chain: User → Proposal ↔ Ethics → Project → Grant/Budget/Payment → Publication. Nearly all documents are scoped by programTier (UG/PG)."
    ),
    imageParagraph("db-erd.png", 620, 349),
    caption("Figure 1. JUST RMS database relationships (ER overview)"),
    heading("2. Core collections"),
    bullet("users — accounts, roles, programTier, status"),
    bullet("proposals — reviewPipeline, assignees, proposalKind (voluntary | grant_fund_call)"),
    bullet("ethicsapplications — 1:1 with proposal; JUREC approval meta"),
    bullet("projects — created on Director approve; closure workflow"),
    bullet("fundingcalls / grants / budgets / payments / purchaseorders"),
    bullet("publications (≤1 per project), repositoryitems, researchgroups, thesisgroups"),
    bullet("departments, conversations, notifications, institutionalpolicies, auditevents"),
    heading("3. Proposal review fields"),
    body(
      "proposals.assignedReviewers, assignedCommittee, assignedFinance store User refs. reviewPipeline stages: adminScreening, peerReview, committeeReview, financeReview (pending | in_progress | passed | failed | skipped)."
    ),
    heading("4. Status examples"),
    bullet("Proposal: draft | submitted | under_review | approved | rejected | revision_requested"),
    bullet("Project: active | completed | on_hold | closing | closed"),
    bullet("Grant: draft | submitted | pending_finance | approved | active | closed | rejected"),
    heading("5. Module map (visual)"),
    ...optionalRepoImage("JUST-RMS-All-Modules.png", 580, 360),
    ...(fs.existsSync(path.join(DOCS, "JUST-RMS-All-Modules.png"))
      ? [caption("Figure 2. Modules mapped across the system")]
      : []),
    ...optionalRepoImage("JUST-RMS-Connections-Diagram.png", 580, 360),
    ...(fs.existsSync(path.join(DOCS, "JUST-RMS-Connections-Diagram.png"))
      ? [caption("Figure 3. Data / module connections")]
      : []),
  ];
  await writeDoc("DATABASE_STRUCTURE.docx", children);
}

async function main() {
  if (!fs.existsSync(path.join(FIGURES, "arch-layers.png")) || !fs.existsSync(path.join(FIGURES, "db-erd.png"))) {
    console.error("Missing docs/figures/arch-layers.png or db-erd.png");
    process.exit(1);
  }
  await buildArchitecture();
  await buildDatabase();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

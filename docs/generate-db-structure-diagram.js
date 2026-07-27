/**
 * Generate JUST RMS database structure ER diagram (PNG + Word).
 * Run from docs/: node generate-db-structure-diagram.js
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  HeadingLevel,
  convertInchesToTwip,
} = require("docx");

const DOCS = __dirname;
const FIGURES = path.join(DOCS, "figures");
const HTML_PATH = path.join(FIGURES, "db-structure-er.html");
const PNG_PATH = path.join(FIGURES, "db-structure-er.png");
const OUT_WORD = path.join(DOCS, "DATABASE_STRUCTURE_DIAGRAM.docx");
const OUT_DB = path.join(DOCS, "DATABASE_STRUCTURE.docx");

const FONT = "Times New Roman";
const SIZE = 22;
const LINE = 360;

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Segoe UI", Arial, sans-serif;
    background: #0b1220;
    color: #e2e8f0;
  }
  .wrap {
    width: 1600px;
    padding: 36px 40px 48px;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 32px;
    color: #7dd3fc;
    letter-spacing: 0.2px;
  }
  .sub {
    margin: 0 0 28px;
    color: #94a3b8;
    font-size: 16px;
  }
  .legend {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    margin-bottom: 22px;
    font-size: 13px;
    color: #cbd5e1;
  }
  .dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    margin-right: 6px;
    vertical-align: middle;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1.35fr 1fr;
    gap: 22px;
    align-items: start;
  }
  .col {
    display: grid;
    gap: 14px;
  }
  .group {
    border: 1px solid rgba(125,211,252,0.28);
    border-radius: 16px;
    background: rgba(15,23,42,0.92);
    padding: 14px;
  }
  .group h2 {
    margin: 0 0 10px;
    font-size: 15px;
    color: #38bdf8;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }
  .entity {
    border-radius: 12px;
    border: 1px solid rgba(148,163,184,0.35);
    overflow: hidden;
    margin-bottom: 10px;
    background: #111827;
  }
  .entity:last-child { margin-bottom: 0; }
  .entity .name {
    padding: 8px 10px;
    font-weight: 800;
    font-size: 14px;
    color: #0b1220;
  }
  .entity .fields {
    padding: 8px 10px 10px;
    font-size: 12px;
    line-height: 1.55;
    color: #cbd5e1;
  }
  .entity .fields b { color: #7dd3fc; }
  .c-core .name { background: #38bdf8; }
  .c-finance .name { background: #34d399; }
  .c-output .name { background: #a78bfa; }
  .c-support .name { background: #fbbf24; color: #111827; }
  .c-user .name { background: #f472b6; }
  .rels {
    margin-top: 24px;
    border: 1px solid rgba(125,211,252,0.28);
    border-radius: 16px;
    padding: 16px 18px;
    background: rgba(15,23,42,0.92);
  }
  .rels h2 {
    margin: 0 0 10px;
    font-size: 16px;
    color: #7dd3fc;
  }
  .rels-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 28px;
    font-size: 13px;
    color: #e2e8f0;
  }
  .rel span { color: #38bdf8; font-weight: 700; }
  .footer {
    margin-top: 18px;
    color: #94a3b8;
    font-size: 13px;
  }
</style>
</head>
<body>
  <div class="wrap" id="capture">
    <h1>JUST RMS — Database Structure (ER Diagram)</h1>
    <p class="sub">MongoDB / Mongoose · 18 collections · ObjectId relationships (current implementation)</p>
    <div class="legend">
      <div><span class="dot" style="background:#f472b6"></span>Users &amp; Org</div>
      <div><span class="dot" style="background:#38bdf8"></span>Core Research Lifecycle</div>
      <div><span class="dot" style="background:#34d399"></span>Finance</div>
      <div><span class="dot" style="background:#a78bfa"></span>Outputs</div>
      <div><span class="dot" style="background:#fbbf24"></span>Support / Audit</div>
    </div>

    <div class="grid">
      <div class="col">
        <div class="group">
          <h2>Users &amp; Organization</h2>
          <div class="entity c-user">
            <div class="name">User</div>
            <div class="fields">
              <b>_id</b>, fullName, email, passwordHash<br/>
              role, status, department, rank<br/>
              programTier, isProtected
            </div>
          </div>
          <div class="entity c-user">
            <div class="name">Department</div>
            <div class="fields"><b>_id</b>, faculty, name, code</div>
          </div>
          <div class="entity c-core">
            <div class="name">ResearchGroup</div>
            <div class="fields">
              <b>_id</b>, name, kind<br/>
              departmentId → Department<br/>
              members[].userId → User<br/>
              createdBy → User, programTier
            </div>
          </div>
          <div class="entity c-core">
            <div class="name">ThesisGroup</div>
            <div class="fields">
              <b>_id</b>, title, students[] (min 4)<br/>
              supervisorId → User<br/>
              coordinatorId → User<br/>
              researchGroupId → ResearchGroup<br/>
              chapters[], meetings[], finalDocument
            </div>
          </div>
        </div>
      </div>

      <div class="col">
        <div class="group">
          <h2>Core Research Lifecycle</h2>
          <div class="entity c-core">
            <div class="name">Proposal</div>
            <div class="fields">
              <b>_id</b>, title, abstract, status, version<br/>
              proposalKind: voluntary | grant_fund_call<br/>
              researcherId → User<br/>
              fundingCallId → FundingCall (optional)<br/>
              ethicsApplicationId → EthicsApplication<br/>
              assignedReviewers / Committee / Finance<br/>
              reviewPipeline, currentReviewStage, programTier
            </div>
          </div>
          <div class="entity c-core">
            <div class="name">EthicsApplication</div>
            <div class="fields">
              <b>_id</b>, status, projectTitle<br/>
              proposalId → Proposal<br/>
              researcherId → User<br/>
              approval.refNumber / certificate
            </div>
          </div>
          <div class="entity c-core">
            <div class="name">FundingCall</div>
            <div class="fields">
              <b>_id</b>, title, status, type<br/>
              amountCap, currency, dates<br/>
              createdBy → User, programTier
            </div>
          </div>
          <div class="entity c-core">
            <div class="name">Project</div>
            <div class="fields">
              <b>_id</b>, title, status, progressReports[]<br/>
              proposalId → Proposal<br/>
              researcherId → User<br/>
              closure workflow fields, programTier
            </div>
          </div>
          <div class="entity c-finance">
            <div class="name">Grant</div>
            <div class="fields">
              <b>_id</b>, title, status, amountRequested<br/>
              researcherId → User<br/>
              callId → FundingCall<br/>
              proposalId → Proposal<br/>
              projectId → Project
            </div>
          </div>
        </div>
      </div>

      <div class="col">
        <div class="group">
          <h2>Finance &amp; Outputs</h2>
          <div class="entity c-finance">
            <div class="name">Budget</div>
            <div class="fields">
              <b>_id</b>, items[], totals<br/>
              projectId → Project<br/>
              grantId → Grant<br/>
              ownerResearcherId → User
            </div>
          </div>
          <div class="entity c-finance">
            <div class="name">Payment</div>
            <div class="fields">
              <b>_id</b>, amount, status<br/>
              budgetId → Budget<br/>
              projectId → Project, grantId → Grant<br/>
              requestedBy / paidBy → User
            </div>
          </div>
          <div class="entity c-finance">
            <div class="name">PurchaseOrder</div>
            <div class="fields">
              <b>_id</b>, status, lineItems[]<br/>
              budgetId → Budget<br/>
              projectId → Project, grantId → Grant<br/>
              requestedBy / directorApprovedBy → User
            </div>
          </div>
          <div class="entity c-output">
            <div class="name">Publication</div>
            <div class="fields">
              <b>_id</b>, title, type, status<br/>
              researcherId → User<br/>
              projectId → Project
            </div>
          </div>
          <div class="entity c-output">
            <div class="name">RepositoryItem</div>
            <div class="fields">
              <b>_id</b>, title, filePath, type<br/>
              uploadedBy → User<br/>
              projectId → Project<br/>
              groupId → ResearchGroup
            </div>
          </div>
        </div>

        <div class="group">
          <h2>Support Collections</h2>
          <div class="entity c-support">
            <div class="name">Notification</div>
            <div class="fields"><b>_id</b>, userId → User, title, body, link, type, programTier</div>
          </div>
          <div class="entity c-support">
            <div class="name">Conversation</div>
            <div class="fields"><b>_id</b>, participants[] → User, messages[], groupId → ResearchGroup</div>
          </div>
          <div class="entity c-support">
            <div class="name">InstitutionalPolicy</div>
            <div class="fields"><b>_id</b>, title, module, body, version, programTier</div>
          </div>
          <div class="entity c-support">
            <div class="name">AuditEvent</div>
            <div class="fields"><b>_id</b>, entityType, entityId, action, actorId → User</div>
          </div>
        </div>
      </div>
    </div>

    <div class="rels">
      <h2>Primary ObjectId Relationships</h2>
      <div class="rels-grid">
        <div><span>User</span> 1—* Proposal / Project / Grant / ThesisGroup</div>
        <div><span>Proposal</span> 1—0..1 EthicsApplication</div>
        <div><span>FundingCall</span> 1—* Proposal (grant_fund_call)</div>
        <div><span>Proposal</span> 1—0..1 Project (on Director approve)</div>
        <div><span>FundingCall</span> 1—* Grant</div>
        <div><span>Proposal / Project</span> 1—0..1 Grant</div>
        <div><span>Project / Grant</span> 1—* Budget</div>
        <div><span>Budget</span> 1—* Payment / PurchaseOrder</div>
        <div><span>Project</span> 1—* Publication / RepositoryItem</div>
        <div><span>ResearchGroup</span> 1—* ThesisGroup / Conversation</div>
        <div><span>Department</span> 1—* ResearchGroup</div>
        <div><span>User</span> 1—* Notification / AuditEvent</div>
      </div>
    </div>
    <p class="footer">Source of truth: backend/src/models/*.js · Program tier (undergraduate | postgraduate) scopes most business documents</p>
  </div>
</body>
</html>`;

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 160, line: LINE },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, font: FONT, size: SIZE, bold: !!opts.bold })],
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 280, after: 140, line: LINE },
    children: [new TextRun({ text, font: FONT, size: level === HeadingLevel.HEADING_1 ? 28 : 24, bold: true })],
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 200, line: LINE },
    children: [new TextRun({ text, font: FONT, size: 20, italics: true })],
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 2200, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    },
    children: [
      new Paragraph({
        spacing: { after: 40, line: 276 },
        children: [new TextRun({ text: String(text ?? ""), font: FONT, size: 18, bold: !!opts.bold })],
      }),
    ],
  });
}

function table(headers, rows, widths) {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      new TableRow({ children: headers.map((h, i) => cell(h, { bold: true, width: widths[i] })) }),
      ...rows.map((r) => new TableRow({ children: r.map((v, i) => cell(v, { width: widths[i] })) })),
    ],
  });
}

async function capturePng() {
  fs.mkdirSync(FIGURES, { recursive: true });
  fs.writeFileSync(HTML_PATH, HTML, "utf8");

  const chromePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    defaultViewport: { width: 1680, height: 1400 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(`file:///${HTML_PATH.replace(/\\/g, "/")}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#capture");
    const el = await page.$("#capture");
    await el.screenshot({ path: PNG_PATH, type: "png" });
    console.log("PNG:", PNG_PATH);
  } finally {
    await browser.close();
  }
}

async function writeWord() {
  const png = fs.readFileSync(PNG_PATH);
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120, line: LINE },
      children: [new TextRun({ text: "DATABASE STRUCTURE DIAGRAM", font: FONT, size: 32, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280, line: LINE },
      children: [
        new TextRun({
          text: "Jamhuriya Research Management System (JUST RMS)",
          font: FONT,
          size: 24,
          italics: true,
        }),
      ],
    }),
    body(
      "This document presents the entity-relationship diagram of the MongoDB database used by JUST RMS. Relationships are implemented as Mongoose ObjectId references in backend/src/models. The system currently uses 18 collections."
    ),
    heading("1. Entity-Relationship Diagram"),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        new ImageRun({
          type: "png",
          data: png,
          transformation: { width: 620, height: 520 },
          altText: {
            title: "Database ER Diagram",
            description: "JUST RMS MongoDB entity relationships",
            name: "db-structure-er.png",
          },
        }),
      ],
    }),
    caption("Figure 1: JUST RMS database structure (18 MongoDB collections)"),

    heading("2. Collections by domain"),
    table(
      ["Domain", "Collections"],
      [
        ["Users & Organization", "User, Department, ResearchGroup, ThesisGroup"],
        ["Core Research Lifecycle", "Proposal, EthicsApplication, FundingCall, Project, Grant"],
        ["Finance", "Budget, Payment, PurchaseOrder"],
        ["Outputs", "Publication, RepositoryItem"],
        ["Support / Audit", "Notification, Conversation, InstitutionalPolicy, AuditEvent"],
      ],
      [2800, 6200]
    ),
    new Paragraph({ spacing: { after: 180 }, children: [] }),

    heading("3. Key relationship summary"),
    table(
      ["From", "To", "Cardinality", "Meaning"],
      [
        ["User", "Proposal / Project / Grant", "1 — *", "Researcher owns research records"],
        ["Proposal", "EthicsApplication", "1 — 0..1", "Embedded/linked JUREC ethics case"],
        ["FundingCall", "Proposal", "1 — *", "Grant applications linked by callId"],
        ["Proposal", "Project", "1 — 0..1", "Created on Director approval"],
        ["FundingCall / Proposal / Project", "Grant", "1 — 0..1 / *", "Awarded funding record"],
        ["Project / Grant", "Budget", "1 — *", "Budget lines for funded work"],
        ["Budget", "Payment / PurchaseOrder", "1 — *", "Disbursement and procurement"],
        ["Project", "Publication / RepositoryItem", "1 — *", "Research outputs and files"],
        ["ResearchGroup", "ThesisGroup", "1 — *", "Optional group link for thesis"],
        ["User", "Notification / AuditEvent", "1 — *", "Alerts and audit trail"],
      ],
      [2200, 2200, 1400, 3200]
    ),
    new Paragraph({ spacing: { after: 180 }, children: [] }),

    heading("4. Notes"),
    body(
      "Most business documents include a programTier field (undergraduate | postgraduate). Shared staff accounts send X-Program-Tier so queries stay portal-scoped. Password fields are stored as bcrypt hashes. File paths for uploads (proposal documents, thesis final manuscripts, repository files) point to the server uploads directory."
    ),
    body(
      "Source of truth for field-level schema details remains backend/src/models and the companion document DATABASE_STRUCTURE.docx."
    ),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.9),
              bottom: convertInchesToTwip(0.9),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "JUST RMS — Database Structure Diagram",
                    font: FONT,
                    size: 16,
                    italics: true,
                    color: "666666",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Page ", font: FONT, size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUT_WORD, buffer);
  // Also refresh the figure used by DATABASE_STRUCTURE.docx
  fs.copyFileSync(PNG_PATH, path.join(FIGURES, "db-current.png"));
  console.log("Word:", OUT_WORD);
  console.log("Updated figure:", path.join(FIGURES, "db-current.png"));
  console.log("Size KB:", Math.round(buffer.length / 1024));
}

async function main() {
  await capturePng();
  await writeWord();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

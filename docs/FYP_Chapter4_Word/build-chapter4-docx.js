/**
 * Build Chapter 4 Word document with embedded screenshots (JUST FYP style).
 * Run from docs/: node FYP_Chapter4_Word/build-chapter4-docx.js
 */
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  convertInchesToTwip,
} = require("docx");

const DOCS = path.resolve(__dirname, "..");
const FIG = path.join(DOCS, "fyp-chapter4-figures");
const OUT_DIR = __dirname;
const OUT = path.join(OUT_DIR, "Chapter_4_Implementation_and_Results.docx");

const FONT = "Times New Roman";
const SIZE = 24; // half-points = 12pt
const LINE = 480; // double spacing (240 = single)

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 200, line: LINE },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    ...opts.para,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: SIZE,
        bold: !!opts.bold,
        italics: !!opts.italics,
      }),
    ],
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 360, after: 200, line: LINE },
    children: [new TextRun({ text, font: FONT, size: level === HeadingLevel.HEADING_1 ? 28 : 26, bold: true })],
  });
}

function caption(text) {
  return new Paragraph({
    spacing: { before: 120, after: 280, line: LINE },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, font: FONT, size: SIZE, bold: true })],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 120, line: LINE },
    indent: { left: convertInchesToTwip(0.35) },
    children: [new TextRun({ text: `• ${text}`, font: FONT, size: SIZE })],
  });
}

function figureBlock(fileName, captionText, maxWidthPx = 520) {
  const filePath = path.join(FIG, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing figure: ${filePath}`);
  }
  const data = fs.readFileSync(filePath);
  const { width: nw, height: nh } = pngSize(data);
  const width = Math.min(maxWidthPx, nw);
  const height = Math.round((nh / nw) * width);

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [
        new ImageRun({
          type: "png",
          data,
          transformation: { width, height },
          altText: { title: captionText, description: captionText, name: fileName },
        }),
      ],
    }),
    caption(captionText),
  ];
}

function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width || 2000, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
    },
    children: [
      new Paragraph({
        spacing: { after: 40, line: 276 },
        children: [
          new TextRun({
            text: String(text ?? ""),
            font: FONT,
            size: 20,
            bold: !!opts.bold,
          }),
        ],
      }),
    ],
  });
}

function simpleTable(headers, rows, colWidths) {
  const widths = colWidths || headers.map(() => Math.floor(9000 / headers.length));
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: headers.map((h, i) => cell(h, { bold: true, width: widths[i] })),
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: r.map((v, i) => cell(v, { width: widths[i] })),
          })
      ),
    ],
  });
}

async function main() {
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120, line: LINE },
      children: [new TextRun({ text: "CHAPTER IV: IMPLEMENTATION AND RESULTS", font: FONT, size: 32, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200, line: LINE },
      children: [new TextRun({ text: "(Mobile and Web Development based FYPs)", font: FONT, size: SIZE, italics: true })],
    }),
    body("Project Title: Design and Implementation of a Web-Based Research Management System for Jamhuriya University", { align: AlignmentType.LEFT }),
    body("Specialization: Computer Applications (Mobile and Web based FYP)", { align: AlignmentType.LEFT }),
    body("Faculty: Faculty of Computer and Information Technology", { align: AlignmentType.LEFT }),
    body("University: Jamhuriya University of Science and Technology (JUST)", { align: AlignmentType.LEFT }),

    heading("4.1 Introduction"),
    body(
      "This chapter presents the implementation, testing, and evaluation of the Jamhuriya Research Management System (JUST RMS). It connects the methodology described in Chapter III to a working web application and reports how the system was built, verified, and assessed against the research objectives."
    ),
    body(
      "The system is a web-based Final Year Project (responsive in the browser). A separate native mobile application was out of scope; mobile access is supported through a responsive React user interface that works on phones and tablets. The implementation covers:"
    ),
    bullet("Web application screens (researcher, coordinator, finance, director, leadership)."),
    bullet("Backend REST API and MongoDB data layer."),
    bullet("Functional, integration, and security testing."),
    bullet("Results that show the system meets the defined requirements for managing the research lifecycle from proposal to closure, including thesis supervision."),
    body(
      "All screenshots in this chapter were captured from the running local application (React client on port 5173, Express API on port 5000) using the seeded demo institutional accounts."
    ),

    heading("4.2 Snapshots of the System"),
    body(
      "This section shows the main web interfaces as implemented and how they were tested. Each figure is centered with the caption below the screenshot, in line with the JUST FYP guideline."
    ),

    heading("Figure 4.1 — Login page and demo institutional accounts", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-1-login.png", "Figure 4.1: Login page of the Jamhuriya Research Portal with demo institutional accounts."),
    body(
      "Users sign in with university email and password. Only the Research Director creates accounts. Demo accounts illustrate the active roles after removal of HR Officer and Donor Agency logins: Director (shared), plus Undergraduate and Postgraduate Coordinator, Finance, Leadership, and Researcher/PI accounts."
    ),

    heading("Figure 4.2 — Program portal selection", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-2-program-portal.png", "Figure 4.2: Select Program Portal — Undergraduate or Postgraduate."),
    body(
      "After login, the Research Director must select the Undergraduate or Postgraduate portal. Other accounts are fixed to one portal. Portal choice is stored in session storage and sent to the API as X-Program-Tier, so UG and PG data remain isolated."
    ),

    heading("Figure 4.3 — Research Director dashboard", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-3-director-dashboard.png", "Figure 4.3: Institutional Dashboard with live module counts (Undergraduate portal)."),
    body(
      "Live counts are shown for Ethics, Projects, Proposals, Grants, Thesis, and related modules, with KPI summary cards and charts for project status, funding, and research output."
    ),

    heading("Figure 4.4 — Proposals review queue", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-4-proposals.png", "Figure 4.4: Proposals (Review Queue) with status filters."),
    body(
      "Staff see voluntary research proposals with status filters (Total, Submitted, Under review, Revision, Approved, Rejected). Funded applications are started from Funding Calls, not from this voluntary queue."
    ),

    heading("Figure 4.5 — Multi-stage proposal and ethics review", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-5-proposal-review.png", "Figure 4.5: Director review — Proposal + Ethics pipeline."),
    body(
      "Director review screen combining proposal and ethics (REC) in one pipeline. Approved proposals show linked ethics status, JUREC certificate reference, certificate download, and peer-reviewer assignment (University Leadership)."
    ),

    heading("Figure 4.6 — Ethics (JUREC) clearance", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-6-ethics.png", "Figure 4.6: Research Ethical Clearance module."),
    body(
      "Researchers apply; the Research Director reviews, approves, and signs the JUREC ethics certificate. Approved applications expose View and Download certificate."
    ),

    heading("Figure 4.7 — Projects list and workflow", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-7-projects.png", "Figure 4.7: Projects module — voluntary and grant-funded."),
    body(
      "Voluntary projects are created when a proposal is approved; grant-funded projects come from Funding Calls. Each project card shows PI, status, progress, and links to open the workflow or publish pipeline."
    ),

    heading("Figure 4.8 — Funding calls", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-8-funding-calls.png", "Figure 4.8: Funding Calls management."),
    body(
      "The Research Director creates and publishes Internal or External calls (no Leadership approval required). Open calls allow researchers to apply; applications appear under Grants."
    ),

    heading("Figure 4.9 — Finance and budgets", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-9-budgets.png", "Figure 4.9: Finance and Budget dashboard."),
    body(
      "Institutional totals show allocated, disbursed, remaining, and pending approval amounts. Workflow: researcher requests → Director approves → Finance pays (with payment method). Purchase-order review is handled in this finance area."
    ),

    heading("Figure 4.10 — Thesis groups", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-10-thesis.png", "Figure 4.10: Thesis groups — titles and supervision."),
    body(
      "Students choose a title; the supervisor enters it; the Faculty Coordinator accepts or rejects. Thesis groups support chapters, meetings, and final PDF/Word document upload by the supervisor for staff download."
    ),

    heading("Figure 4.11 — Publications and outputs", HeadingLevel.HEADING_2),
    ...figureBlock("fig-4-11-publications.png", "Figure 4.11: Publications and Outputs linked to projects."),
    body(
      "Staff see one output per project (linked by projectId), with type categories (papers, conference, books, thesis, patents, etc.). The institutional repository module stores downloadable research files for the same portal."
    ),

    heading("4.2.1 Web Application Implementation and Testing", HeadingLevel.HEADING_2),
    body(
      "The web client was implemented with React.js (Vite). Role-based menus and protected routes ensure each user sees only authorized modules. Active institutional roles in the implemented system are:"
    ),
    simpleTable(
      ["Role", "Main web modules"],
      [
        ["Research Director", "Users, departments, proposals, ethics, funding calls, projects, budgets, donor reports, analytics, KPI"],
        ["Faculty Coordinator", "Proposals/faculty review, thesis title accept/reject, groups, projects"],
        ["Finance Officer", "Budgets, payments, purchase-order review, grant funding approval, finance reports"],
        ["Researcher / PI (Supervisor)", "Proposals, projects, grants, publications, repository, thesis supervision, meetings, final thesis upload"],
        ["University Leadership", "Peer review scoring, policies, grants visibility, KPI"],
      ],
      [2800, 6200]
    ),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
    body(
      "Undergraduate (UG) and Postgraduate (PG) data are isolated by program tier. The Research Director selects the portal after login (Figure 4.2); other accounts are fixed to one portal."
    ),

    heading("4.2.1.1 Functional Testing", HeadingLevel.HEADING_3),
    body(
      "Functional testing used a black-box approach: testers entered inputs through the UI and checked expected outputs and database side-effects, without relying on internal code paths for pass/fail decisions."
    ),
    body("Table 4.1 Sample functional test cases (web application)", { bold: true, align: AlignmentType.LEFT }),
    simpleTable(
      ["Test ID", "Module", "Input / Action", "Expected Result", "Status"],
      [
        ["FT-01", "Auth", "Valid director credentials", "Login success; portal selection", "Pass"],
        ["FT-02", "Auth", "Invalid password", "Error; no session", "Pass"],
        ["FT-03", "Proposals", "Submit proposal with PDF", "Status submitted; visible to staff", "Pass"],
        ["FT-04", "Review", "Leadership peer score 1–5", "Peer stage marked", "Pass"],
        ["FT-05", "Ethics", "Director approves ethics", "Certificate downloadable", "Pass"],
        ["FT-06", "Approval", "Director approves proposal", "Project auto-created", "Pass"],
        ["FT-07", "Grants", "Apply via funding call", "Grant application stored", "Pass"],
        ["FT-08", "Finance", "Authorize grant budget", "Budget available", "Pass"],
        ["FT-09", "PO", "PO → Finance → Director → Pay", "Pipeline advances", "Pass"],
        ["FT-10", "Thesis", "Supervisor proposes title", "Coordinator Accept/Reject", "Pass"],
        ["FT-11", "Thesis", "Upload final PDF/Word", "File stored; downloadable", "Pass"],
        ["FT-12", "Tier", "UG user vs PG records", "403 / empty list", "Pass"],
      ],
      [900, 1100, 2400, 2800, 900]
    ),
    new Paragraph({ spacing: { after: 200 }, children: [] }),

    heading("4.2.1.2 UI/UX Evaluation", HeadingLevel.HEADING_3),
    body("Design principles applied:"),
    bullet("Consistency: Shared layout (sidebar, top bar), cards, buttons, and status badges across modules (Figures 4.3–4.11)."),
    bullet("Responsiveness: Layout adapts from desktop to smaller screens."),
    bullet("Clarity: Filterable statistics; green/amber/red semantic colors for approved/pending/rejected."),
    bullet("Navigation: Role-filtered sidebar; deep-links from notifications."),
    body(
      "Improvements after testing included clearer ethics certificate download, thesis title Accept/Reject on the card, and a unified navy–sky theme."
    ),

    heading("4.2.2 Mobile Application Implementation and Testing", HeadingLevel.HEADING_2),
    body(
      "A native Android/iOS application was not developed in this FYP (out of scope). Mobile use is through the responsive web UI. Native app development is listed under future work in Chapter V."
    ),

    heading("4.3 Backend and API Development & Testing"),
    heading("4.3.1 Backend", HeadingLevel.HEADING_2),
    body(
      "The backend was implemented with Node.js and Express.js. MongoDB (via Mongoose) stores institutional research data. The API is organized by domain controllers and routes (proposals, projects, grants, budgets, ethics, thesis groups, analytics, users, notifications, etc.)."
    ),
    body("Figure 4.12: Three-tier architecture — React browser client → Express REST API → MongoDB.", { bold: true, align: AlignmentType.CENTER }),
    body("React Web Client (Vite / React Router / JWT) → Express REST API (RBAC, Multer uploads) → MongoDB (local / Atlas).", {
      align: AlignmentType.CENTER,
      italics: true,
    }),
    body("Main backend responsibilities:"),
    bullet("Authenticate users (JWT) and enforce role-based access control (RBAC)."),
    bullet("Scope all queries by program tier (UG / PG)."),
    bullet("Persist uploads under /uploads and serve static files securely within the app."),
    bullet("Trigger side-effects (e.g., create project when proposal is approved; notify staff when supervisor uploads final thesis)."),

    heading("4.3.2 API Development", HeadingLevel.HEADING_2),
    body(
      "The API follows RESTful conventions (GET, POST, PATCH, PUT, DELETE) under /api/.... Clients send Authorization: Bearer <token> and X-Program-Tier when required."
    ),
    body("Table 4.2 Sample REST endpoints", { bold: true, align: AlignmentType.LEFT }),
    simpleTable(
      ["Method", "Endpoint (example)", "Purpose"],
      [
        ["POST", "/api/auth/login", "Sign in"],
        ["GET", "/api/proposals", "List proposals (role-scoped)"],
        ["POST", "/api/proposals/:id/submit", "Submit proposal"],
        ["GET", "/api/ethics", "Ethics applications"],
        ["GET", "/api/projects", "Projects"],
        ["POST", "/api/funding-calls", "Create funding call (Director)"],
        ["GET", "/api/grants", "Funding-call applications"],
        ["GET", "/api/budgets", "Budgets / finance views"],
        ["GET", "/api/thesis-groups", "Thesis groups"],
        ["POST", "/api/thesis-groups/:id/final-document", "Upload final thesis PDF/Word"],
        ["GET", "/api/analytics/dashboard", "Dashboard metrics"],
      ],
      [1200, 4200, 3600]
    ),
    new Paragraph({ spacing: { after: 200 }, children: [] }),

    heading("4.3.3 Testing (Backend and APIs)", HeadingLevel.HEADING_2),
    bullet("Manual API checks with authenticated sessions from the UI and scripts."),
    bullet("Role smoke verification for all institutional roles."),
    bullet("Error handling: invalid IDs return 404; forbidden roles return 403; missing files return 400."),
    bullet("Load: institutional seed and realistic record volumes exercised list/filter endpoints without failure in local testing."),

    heading("4.4 Security Implementation and Testing"),
    heading("4.4.1 Authentication and Authorization", HeadingLevel.HEADING_2),
    bullet("Authentication: Email/password login; passwords hashed (bcrypt); sessions use JWT access tokens."),
    bullet("Authorization: authorizeRoles(...) on sensitive routes; frontend ProtectedRoute mirrors backend rules."),
    bullet("Portal isolation: Program-tier middleware prevents cross-portal data leakage (Figure 4.2)."),
    bullet("Account lifecycle: Only the Research Director creates and activates users for the five active roles."),

    heading("4.4.2 Input Validation", HeadingLevel.HEADING_2),
    bullet("Required fields validated on create/update."),
    bullet("File uploads restricted to PDF / DOC / DOCX with size limits (Multer)."),
    bullet("Mongoose schemas enforce types and enums (statuses, roles)."),
    bullet("Client-side checks reduce bad requests; server-side checks remain authoritative."),

    heading("4.4.3 Security Testing Methods", HeadingLevel.HEADING_2),
    simpleTable(
      ["Activity", "Result"],
      [
        ["Unauthorized access to director routes", "Blocked (403)"],
        ["Researcher accessing another portal’s data", "Blocked / empty"],
        ["Invalid JWT", "Rejected"],
        ["Upload of disallowed MIME types", "Rejected"],
        ["Shared staff accounts", "One Director, Coordinator, Finance, and Leadership for the whole system"],
      ],
      [4500, 4500]
    ),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
    body(
      "No production penetration test with OWASP ZAP/Burp was completed in this FYP timeframe; basic security standards for an institutional intranet-style app were met. Deeper penetration testing is recommended for future hardening (see Chapter V)."
    ),

    heading("4.5 Implementation Results Summary"),
    body("Table 4.3 Mapping of results to project goals", { bold: true, align: AlignmentType.LEFT }),
    simpleTable(
      ["Area", "Result", "Evidence"],
      [
        ["Proposal → Project", "Director approval creates linked project", "Fig. 4.4–4.7"],
        ["Ethics", "Director review; certificate download", "Fig. 4.5–4.6"],
        ["Peer review", "Leadership scores; director does not re-enter", "Fig. 4.5"],
        ["Funding & finance", "Calls, grants, budgets, PO review", "Fig. 4.8–4.9"],
        ["Thesis (UG)", "Groups, title accept/reject, final PDF/Word", "Fig. 4.10"],
        ["Portals", "UG/PG labels; shared staff see both", "Fig. 4.2–4.3"],
        ["Dashboards", "Live module counts", "Fig. 4.3"],
        ["Publications", "Project-linked outputs", "Fig. 4.11"],
        ["Role model", "Five active roles; Finance PO; Director ethics/donor", "Fig. 4.1"],
      ],
      [2200, 4800, 2000]
    ),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
    body(
      "Overall, black-box and role-based testing confirmed that core end-to-end workflows operate correctly for the implemented MERN stack system. Screenshots in Section 4.2 document the delivered interfaces; Sections 4.3–4.4 document the API and security controls behind those screens."
    ),
    new Paragraph({
      spacing: { before: 400, after: 200, line: LINE },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "End of Chapter IV — JUST RMS Mobile/Web FYP", font: FONT, size: SIZE, italics: true })],
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          styles: [
            {
              id: "Normal",
              name: "Normal",
              run: { font: FONT, size: SIZE },
              paragraph: { spacing: { line: LINE } },
            },
          ],
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
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
                    text: "JUST RMS — Chapter IV",
                    font: FONT,
                    size: 18,
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
                  new TextRun({ text: "Page ", font: FONT, size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 }),
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
  fs.writeFileSync(OUT, buffer);

  // Also copy PNGs into the Word folder for backup / printing
  const figOut = path.join(OUT_DIR, "figures");
  fs.mkdirSync(figOut, { recursive: true });
  for (const f of fs.readdirSync(FIG).filter((n) => n.endsWith(".png"))) {
    fs.copyFileSync(path.join(FIG, f), path.join(figOut, f));
  }

  console.log("Wrote:", OUT);
  console.log("Size KB:", Math.round(buffer.length / 1024));
  console.log("Figures copied to:", figOut);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

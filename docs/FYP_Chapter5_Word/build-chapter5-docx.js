/**
 * Build Chapter 5 Word document (JUST FYP style — Times New Roman, double spacing).
 * Run from docs/: node FYP_Chapter5_Word/build-chapter5-docx.js
 */
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  convertInchesToTwip,
} = require("docx");

const OUT_DIR = __dirname;
const OUT = path.join(OUT_DIR, "Chapter_5_Discussion_and_Conclusion.docx");

const FONT = "Times New Roman";
const SIZE = 24; // 12pt
const LINE = 480; // double

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 200, line: LINE },
    alignment: opts.align || AlignmentType.JUSTIFIED,
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
  const size = level === HeadingLevel.HEADING_1 ? 28 : level === HeadingLevel.HEADING_2 ? 26 : 24;
  return new Paragraph({
    heading: level,
    spacing: { before: 360, after: 200, line: LINE },
    children: [new TextRun({ text, font: FONT, size, bold: true })],
  });
}

function numbered(n, text) {
  return new Paragraph({
    spacing: { after: 160, line: LINE },
    indent: { left: convertInchesToTwip(0.25) },
    children: [new TextRun({ text: `${n}. ${text}`, font: FONT, size: SIZE })],
  });
}

function bullet(text) {
  return new Paragraph({
    spacing: { after: 120, line: LINE },
    indent: { left: convertInchesToTwip(0.35) },
    children: [new TextRun({ text: `• ${text}`, font: FONT, size: SIZE })],
  });
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

function spacer() {
  return new Paragraph({ spacing: { after: 200 }, children: [] });
}

async function main() {
  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120, line: LINE },
      children: [new TextRun({ text: "CHAPTER V: DISCUSSION AND CONCLUSION", font: FONT, size: 32, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200, line: LINE },
      children: [new TextRun({ text: "(Mobile and Web Development based FYPs)", font: FONT, size: SIZE, italics: true })],
    }),
    body("Project Title: Design and Implementation of a Web-Based Research Management System for Jamhuriya University", {
      align: AlignmentType.LEFT,
    }),
    body("Specialization: Computer Applications (Mobile and Web based FYP)", { align: AlignmentType.LEFT }),
    body("Faculty: Faculty of Computer and Information Technology", { align: AlignmentType.LEFT }),
    body("University: Jamhuriya University of Science and Technology (JUST)", { align: AlignmentType.LEFT }),

    heading("5.1 Introduction"),
    body(
      "This chapter interprets the implementation results of the Jamhuriya Research Management System (JUST RMS), evaluates achievement of the research objectives, compares the work with related systems and local practice, states limitations, and recommends future improvements. It closes the Mobile and Web based Final Year Project report for the Computer Applications specialization."
    ),
    body(
      "The discussion draws on the working MERN stack application documented in Chapter IV (implementation screenshots, functional tests, API design, and security controls). Chapter V therefore focuses on meaning, contribution, and next steps rather than repeating interface descriptions."
    ),

    heading("5.2 Discussion"),
    body(
      "The implemented system demonstrates that a single web platform can replace fragmented paper and spreadsheet research administration for Jamhuriya University. Automation of project creation after proposal approval and structured finance workflows (grant authorization, purchase orders, and payments) reduces manual hand-offs and improves transparency for Directors, Coordinators, Finance officers, and researchers."
    ),
    body(
      "Thesis supervision support (title workflow, chapter progress, meetings, and final manuscript upload in PDF or Word) extends the RMS beyond funded faculty research into undergraduate FYP group management. This aligns with Faculty of Computer and Information Technology practice, where supervisors and faculty coordinators must track student groups through title acceptance and final document submission."
    ),
    body(
      "User-interface consistency (navy and sky theme, shared status badges, and role-filtered menus) improved clarity during testing. The active role model matches institutional practice: the Research Director owns ethics decisions and external funding or donor reporting, while Finance owns purchase-order review."
    ),
    body(
      "Unexpected findings during development included the need for strict program-tier headers on file downloads (for example, ethics certificates) and the importance of keeping legacy status strings (for example, historical procurement_approved) while changing live roles—so database history remains readable without breaking validation. Undergraduate and Postgraduate isolation via X-Program-Tier also required careful session handling so Director portal switches do not leak records across tiers."
    ),

    heading("5.2.1 Comparison with Existing Studies", HeadingLevel.HEADING_2),
    body(
      "University research information systems internationally often cover proposals, ethics, grants, and repositories as separate products. Local practice at many Somali universities still relies on paper forms, email attachments, and spreadsheets. Table 5.1 summarizes how JUST RMS differs from that fragmented practice."
    ),
    body("Table 5.1 Comparison of typical practice and JUST RMS", { bold: true, align: AlignmentType.LEFT }),
    simpleTable(
      ["Aspect", "Typical manual / fragmented practice", "JUST RMS (this study)"],
      [
        ["Proposal tracking", "Email and hard copies", "Online drafts, versions, multi-stage review"],
        ["Ethics", "Separate committee paperwork", "Integrated JUREC path; Director decision and certificate"],
        ["Project creation", "Manual after approval", "Automatic on Director approval"],
        ["Finance", "Spreadsheets", "Budgets, PO pipeline, payments in one portal"],
        ["Thesis groups", "Offline supervisor notes", "Structured groups, meetings, final upload"],
        ["Portals", "Mixed UG/PG files", "Isolated Undergraduate and Postgraduate data"],
      ],
      [1800, 3600, 3600]
    ),
    spacer(),
    body(
      "Compared with generic project tools (for example, Trello or Google Drive alone), JUST RMS is domain-specific: it encodes Jamhuriya roles, funding-call applications, ethics clearance, and thesis rules. Compared with heavy commercial ERPs, it is lighter, open to student maintenance, and tailored to Jamhuriya’s two-portal (Undergraduate / Postgraduate) model. The contribution of this FYP is therefore a working, role-aware institutional prototype rather than a general-purpose task board."
    ),

    heading("5.3 Conclusion"),
    body(
      "This FYP successfully designed and implemented a web-based Research Management System for Jamhuriya University using the MERN stack (MongoDB, Express.js, React.js, and Node.js). The system digitizes the research lifecycle, supports role-based access control, isolates Undergraduate and Postgraduate portals, and includes thesis supervision features required for faculty practice. Testing confirmed that core workflows—from proposal submission through ethics, approval, project creation, finance, publications, and thesis final upload—operate as intended."
    ),
    body(
      "In practical terms, JUST RMS provides one institutional portal where Research Directors, Faculty Coordinators, Finance officers, University Leadership, and Researchers (principal investigators / supervisors) can complete their duties without relying on disconnected paper trails. Screenshots and test results in Chapter IV document that the delivered interfaces and APIs match these goals."
    ),

    heading("5.3.1 Achievement of the Objectives", HeadingLevel.HEADING_2),
    body(
      "Table 5.2 maps the project objectives to achievement status and evidence. Labels should be aligned with Chapter I wording if the official objective list differs slightly."
    ),
    body("Table 5.2 Achievement of research objectives", { bold: true, align: AlignmentType.LEFT }),
    simpleTable(
      ["#", "Objective", "Achievement", "Evidence"],
      [
        ["1", "Digitize proposal submission and review", "Fully achieved", "Proposal forms, documents, multi-stage review UI/API"],
        ["2", "Automate project creation after Director approval", "Fully achieved", "Project record created on approval"],
        ["3", "Manage grants, budgets, payments, and POs (Finance)", "Fully achieved", "Funding calls, grants, budgets, Finance PO review, payments"],
        ["4", "Track publications and repository assets", "Fully achieved", "Publications and repository modules"],
        ["5", "Provide role-based dashboards and reports", "Fully achieved", "Director/Finance/Coordinator/KPI dashboards; analytics PDF where implemented"],
        ["6", "Support UG and PG portals", "Fully achieved", "Tier middleware, Director portal switch, seed accounts per portal"],
      ],
      [600, 3200, 1600, 3600]
    ),
    spacer(),
    body(
      "Additional delivered scope beyond the six aims includes Ethics (JUREC) clearance with certificate download, Thesis groups (including final PDF/Word upload by supervisors), and a clear institutional role model (Finance owns purchase-order review; Director owns ethics and donor reporting)."
    ),

    heading("5.4 Limitations"),
    body("Despite successful delivery of the core system, the following limitations remain:"),
    numbered(1, "No native mobile application was developed; access on phones and tablets is through the responsive web interface only."),
    numbered(2, "Email and SMS notifications are limited; in-app notifications are the primary channel."),
    numbered(3, "A full professional penetration test (for example, OWASP ZAP or Burp Suite full scan) was not completed within the FYP timeframe."),
    numbered(4, "External email delivery and calendar integration were not built."),
    numbered(5, "Multi-campus or multi-university tenancy is out of scope; the system targets Jamhuriya University with UG/PG portals."),
    numbered(6, "Some historical demo and probe scripts exist in the repository for development only and are not part of the production user experience."),
    numbered(7, "Production hosting, institutional SSL certificates, and long-term backup policies depend on university IT after handover."),

    heading("5.5 Recommendations"),
    body("Based on the results and limitations, the following recommendations are proposed:"),
    numbered(1, "Develop a native application or Progressive Web App for supervisors and students who primarily work on mobile devices."),
    numbered(2, "Add reliable email notifications for title decisions, ethics outcomes, funding-call publish events, and payment status changes."),
    numbered(3, "Conduct a formal security audit and harden production configuration (headers, rate limits, secrets management, and backup drills)."),
    numbered(4, "Integrate Turnitin or other plagiarism reporting links into the thesis final-document workflow."),
    numbered(5, "Expand analytics dashboards for faculty accreditation and annual research reporting."),
    numbered(6, "Train Directors, Coordinators, and Finance officers using an institutional user guide before full campus rollout."),
    numbered(7, "Keep seed data and production data separate; run database seed scripts only in controlled development or staging environments."),

    heading("5.6 Closing Remarks"),
    body(
      "JUST RMS shows that a focused student FYP can deliver a usable institutional research portal when requirements are grounded in real university roles and workflows. The MERN implementation is maintainable, the Undergraduate/Postgraduate split protects data boundaries, and thesis final-document upload closes an important gap for undergraduate supervision. With the recommendations above—especially mobile access, email alerts, and security hardening—the prototype is ready to evolve into a production service under Jamhuriya University IT and Research Office governance."
    ),
    new Paragraph({
      spacing: { before: 400, after: 200, line: LINE },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "End of Chapter V — JUST RMS Mobile/Web FYP", font: FONT, size: SIZE, italics: true })],
    }),
  ];

  const doc = new Document({
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
                    text: "JUST RMS — Chapter V",
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
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, buffer);

  // Keep markdown synced (updated limitations — screenshots already in Ch4 Word)
  const mdPath = path.resolve(__dirname, "../FYP_CHAPTER_5_DISCUSSION_AND_CONCLUSION.md");
  // leave existing md; Word is primary deliverable

  console.log("Wrote:", OUT);
  console.log("Size KB:", Math.round(buffer.length / 1024));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

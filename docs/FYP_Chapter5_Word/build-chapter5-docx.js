/**
 * Build Chapter V: Discussion and Conclusion (aligned with Chapter I objectives).
 * Run: node docs/FYP_Chapter5_Word/build-chapter5-docx.js
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

const DOCS = path.resolve(__dirname, "..");
const OUT_DIR = __dirname;
const OUT_PRIMARY = path.join(OUT_DIR, "Chapter_5_Discussion_and_Conclusion.docx");
const OUT_COPY = path.join(DOCS, "CHAPTER_V_DISCUSSION_AND_CONCLUSION.docx");

const FONT = "Times New Roman";
const SIZE = 24;
const LINE = 480;

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
  const sz = level === HeadingLevel.HEADING_1 ? 28 : level === HeadingLevel.HEADING_2 ? 26 : 24;
  return new Paragraph({
    heading: level,
    spacing: { before: 360, after: 200, line: LINE },
    children: [new TextRun({ text, font: FONT, size: sz, bold: true })],
  });
}

function numbered(n, text) {
  return new Paragraph({
    spacing: { after: 160, line: LINE },
    indent: { left: convertInchesToTwip(0.25) },
    children: [new TextRun({ text: `${n}. ${text}`, font: FONT, size: SIZE })],
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
            size: 18,
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
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120, line: LINE },
      children: [new TextRun({ text: "CHAPTER FIVE", font: FONT, size: 32, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400, line: LINE },
      children: [new TextRun({ text: "DISCUSSION AND CONCLUSION", font: FONT, size: 32, bold: true })],
    })
  );

  // ── 5.1 Introduction ──
  children.push(
    heading("5.1 Introduction"),
    body(
      "This chapter discusses the implementation results of the web-based Research Management System developed for Jamhuriya University of Science and Technology (JUST), evaluates how far the system achieved the objectives stated in Chapter One, identifies limitations, and presents recommendations for future improvement. It closes the Final Year Project report by linking the problem statement, research questions, and objectives in Chapter One to the working MERN-stack application documented in Chapter Four."
    ),
    body(
      "Chapter One established that many institutions still manage research activities through paper files, emails, and spreadsheet applications, resulting in poor organisation, duplication, slow retrieval, weak communication, and limited institutional reporting. The overall aim of this study was to design and develop a web-based Research Management System that improves efficiency and management of research activities within institutions. The discussion below interprets whether the implemented JUST RMS meets that aim using implementation evidence only."
    )
  );

  // ── 5.2 Discussion ──
  children.push(
    heading("5.2 Discussion"),
    body(
      "The implemented system confirms that a single web platform can replace fragmented manual research administration. JUST RMS supports proposal submission and multi-stage review, ethics clearance (JUREC), funding-call applications, automatic project creation after Director approval, finance workflows (budgets, payments, and purchase orders), publications and repository storage, thesis group supervision, notifications, and role-based dashboards. These capabilities address the core inefficiencies described in the Chapter One problem statement: disconnected files, slow approvals, weak tracking, and poor coordination between researchers and administrators."
    ),
    body(
      "In relation to Research Question 1 (challenges of current methods), the background and problem statement in Chapter One identified manual and spreadsheet-based practice as the baseline. Implementation of JUST RMS was designed specifically against those challenges. Features such as draft-to-submit proposal workflows, status badges, multi-stage review gates, and automatic project creation reduce reliance on email attachments and separate Excel trackers. Chapter Four functional and integration tests showed that authenticated users can complete these workflows end to end within one portal."
    ),
    body(
      "In relation to Research Question 2 (centralised database), the system stores research information in MongoDB through eighteen Mongoose collections, including User, Proposal, EthicsApplication, FundingCall, Project, Grant, Budget, Payment, PurchaseOrder, Publication, RepositoryItem, ThesisGroup, Notification, and related support collections. ObjectId relationships link proposals to ethics applications and projects, funding calls to grant applications, and projects to budgets, publications, and repository items. Program-tier fields (undergraduate and postgraduate) keep portal data isolated. This centralised schema directly answers the need for secure, organised storage stated in Chapter One Objective 2."
    ),
    body(
      "In relation to Research Question 3 (design and development of a web-based RMS), the system was implemented with React 19 and Vite on the front end, Node.js with Express 5 on the back end, MongoDB with Mongoose for persistence, and JWT with Role-Based Access Control (RBAC) for authentication and authorisation—matching the technology choices declared in Chapter One. Protected routes and authorizeRoles middleware ensure that Research Directors, Faculty Coordinators, Finance Officers, University Leadership, and Researchers access only authorised modules."
    ),
    body(
      "In relation to Research Question 4 (reporting and communication), the system provides analytics dashboards and PDF reports through the analytics controller, KPI and finance report pages, and institutional reporting routes. Communication and coordination are supported through in-app notifications, conversations/messages, and role-specific queues (peer review assignments, finance review, thesis title accept/reject). These features improve coordination between researchers and administrators compared with informal email-only exchanges."
    ),
    body(
      "In relation to Research Question 5 (effectiveness, usability, and accessibility), Chapter Four documented black-box functional testing, unit-level verification of critical business rules, integration smoke tests (verifyAllStakeholders.js), device compatibility testing across desktop, tablet, and mobile viewports, and informal load observation. The responsive React interface improves accessibility from browsers without requiring a native mobile application. Overall, the system performed as designed for the seeded institutional workflows; formal concurrent load benchmarks and automated unit-test suites remain limited and are noted under limitations."
    ),
    body(
      "Performance, usability, reliability, and effectiveness. List and dashboard endpoints responded without reported timeouts during local verification with seed data. Usability was improved iteratively—for example, locking Director final decision until ready_for_director, and blocking finance review until committee review passes. Reliability is supported by Mongoose validation, JWT/bcrypt authentication, RBAC, and program-tier middleware. Effectiveness is demonstrated by replacing fragmented processes with one authenticated portal covering the research lifecycle described in Chapter One."
    )
  );

  // ── 5.2.1 Comparison ──
  children.push(
    heading("5.2.1 Comparison with Existing Studies", HeadingLevel.HEADING_2),
    body(
      "Chapter One cited the growing importance of Research Management Systems in institutions (Rusli et al., 2018) and the limitations of manual and spreadsheet-based practice (Hamid, 2019). International research systems are often delivered as specialised commercial components for grants, ethics, repositories, or publications. Local practice in many Somali institutions, as framed in Chapter One, still depends on paper forms, email attachments, and Microsoft Excel files."
    ),
    body(
      "Table 5.1 compares the fragmented practice described in Chapter One with the integrated JUST RMS implemented in this study."
    ),
    body("Table 5.1: Comparison of Chapter One baseline practice and JUST RMS.", { bold: true }),
    simpleTable(
      ["Aspect (from Chapter I problem)", "Manual / Excel / email practice", "JUST RMS (this study)"],
      [
        ["Proposal submission and tracking", "Separate files and email; unclear status", "Online drafts, versions, multi-stage peer/committee/finance review"],
        ["Centralised storage", "Records scattered across departments", "Eighteen MongoDB collections with ObjectId links"],
        ["Document management", "Attachments and local folders", "Uploads for proposals, thesis finals, repository items"],
        ["Project tracking", "Manual after approval", "Automatic Project creation on Director approval"],
        ["Reporting", "Difficult institutional reporting", "Role-based dashboards, KPI, finance, and PDF reports"],
        ["Communication / coordination", "Weak email-based coordination", "Notifications, messages, role queues (peer, finance, thesis)"],
        ["Security and access control", "Risk of unauthorised access", "JWT, bcrypt, RBAC, UG/PG portal isolation"],
      ],
      [2600, 3000, 3400]
    ),
    spacer(),
    body(
      "The main advantage of JUST RMS relative to the Chapter One baseline is domain-specific integration: one portal encodes Jamhuriya roles, proposal-to-project automation, ethics certificates, funding calls, finance queues, and thesis supervision. Compared with heavy commercial ERPs, the system is lighter and tailored to JUST’s Undergraduate and Postgraduate portal model. Limitations relative to mature commercial systems—formal penetration testing, large-scale load testing, and native mobile apps—are acknowledged in Section 5.4."
    )
  );

  // ── 5.3 Conclusion ──
  children.push(
    heading("5.3 Conclusion"),
    body(
      "This study successfully designed and developed a web-based Research Management System using React, Node.js with Express, MongoDB with Mongoose, and JWT with RBAC, as proposed in Chapter One. The system improves proposal submission, project tracking, document management, reporting, communication, and secure centralised storage of research information for Jamhuriya University. It thereby responds to the problem of fragmented paper- and spreadsheet-based research administration described in Sections 1.1 and 1.2."
    ),
    body(
      "Key achievements include a working multi-stage review pipeline, ethics (JUREC) integration, funding-call and finance workflows, automatic project creation after Director approval, publications and repository modules, thesis group supervision, and role-based analytics. Undergraduate and Postgraduate portals isolate institutional data through the X-Program-Tier mechanism. Testing in Chapter Four supports the claim that core workflows operate correctly for the five active institutional roles."
    ),
    body(
      "Overall, JUST RMS demonstrates that a focused Final Year Project can deliver a practical institutional research portal when requirements remain aligned with the Chapter One aim: improving efficiency, accessibility, coordination, and management of research activities within the institution."
    )
  );

  // ── 5.3.1 Achievement of Objectives (Chapter I) ──
  children.push(
    heading("5.3.1 Achievement of the Objectives", HeadingLevel.HEADING_2),
    body(
      "Table 5.2 maps each research objective stated in Chapter One (Section 1.3) to implementation evidence and achievement status. The overall aim—to design and develop a web-based Research Management System that improves efficiency and management of research activities—is treated as achieved through the combined delivery of Objectives 1–5."
    ),
    body("Table 5.2: Achievement of Chapter One research objectives.", { bold: true }),
    simpleTable(
      ["Research Objective (Chapter I)", "Evidence from Implementation", "Achievement Status"],
      [
        [
          "1. To identify challenges associated with the current methods used for managing research activities in institutions.",
          "Challenges were identified and documented in Chapter One (manual files, email, Excel, duplication, slow retrieval, weak communication, poor reporting). The system design and Chapter Four/Five discussion treat these challenges as the baseline that JUST RMS was built to address.",
          "Fully Achieved",
        ],
        [
          "2. To design a centralized database for storing and managing research information securely.",
          "Eighteen MongoDB collections implemented in backend/src/models; ObjectId relationships; bcrypt password hashing; JWT authentication; RBAC; program-tier scoping. Documented in DATABASE_STRUCTURE.docx and the ER diagram.",
          "Fully Achieved",
        ],
        [
          "3. To develop a web-based Research Management System for proposal submission, project tracking, and document management.",
          "React/Vite frontend and Express API; ProposalForm and multi-stage review; automatic Project creation on Director approval; Multer uploads for proposals, thesis finals, and repository documents; funding-call and finance modules extending project tracking.",
          "Fully Achieved",
        ],
        [
          "4. To implement reporting and communication features that improve coordination between researchers and administrators.",
          "Analytics dashboards and PDF reports (analyticsController); KPI, finance, donor, and system report pages; in-app notifications; conversations/messages; peer-review, finance, and thesis coordination queues.",
          "Fully Achieved",
        ],
        [
          "5. To evaluate the usability and performance of the proposed Research Management System.",
          "Chapter Four: black-box functional tests, unit-level rule checks, integration smoke tests (verifyAllStakeholders.js), device compatibility schedule (desktop/tablet/mobile), informal load observation, and UI/UX evaluation. Formal JMeter-style concurrent load testing and automated Jest/Vitest suites were not completed and remain a limitation.",
          "Partially Achieved",
        ],
      ],
      [2800, 4200, 1400]
    ),
    spacer(),
    body(
      "Objective 5 is marked Partially Achieved because usability and basic performance were evaluated through structured manual and script-assisted testing, but the project did not complete formal automated regression suites or large-scale concurrent load benchmarks. Beyond the five Chapter One objectives, the implementation also delivered ethics (JUREC) certificates, thesis supervision for undergraduate groups, and Undergraduate/Postgraduate portal isolation, which strengthen institutional fitness within the Chapter One scope."
    ),
    body(
      "Table 5.3 summarises how the Chapter One research questions were answered by the study.",
      { bold: false }
    ),
    body("Table 5.3: Answers to Chapter One research questions.", { bold: true }),
    simpleTable(
      ["Research Question (Chapter I)", "Answer based on this study"],
      [
        [
          "1. What challenges are associated with current research management methods?",
          "Paper, email, and Excel processes cause poor organisation, duplication, slow retrieval, weak communication, and weak institutional reporting (Chapter One). JUST RMS was designed against these challenges.",
        ],
        [
          "2. How can a centralized database improve storage and management?",
          "A MongoDB schema with eighteen linked collections stores proposals, projects, grants, documents, and related records securely under JWT/RBAC and portal scoping.",
        ],
        [
          "3. How can a web-based RMS be designed and developed?",
          "Using React, Node.js/Express, MongoDB/Mongoose, and JWT with RBAC, with role-filtered modules and multi-stage research workflows as implemented in Chapters Three and Four.",
        ],
        [
          "4. How can reporting and communication improve coordination?",
          "Dashboards, PDF reports, notifications, messaging, and role-specific review queues enable faster coordination than informal email-only processes.",
        ],
        [
          "5. How effective is the proposed system in efficiency, usability, and accessibility?",
          "Core workflows passed Chapter Four verification; the responsive web UI supports desktop and mobile browsers. Formal large-scale load testing remains future work.",
        ],
      ],
      [3200, 5800]
    ),
    spacer()
  );

  // ── 5.4 Limitation ──
  children.push(
    heading("5.4 Limitation"),
    body(
      "Despite achievement of the Chapter One aim and most objectives, the following limitations apply within the scope defined in Section 1.6 (web-based RMS for research activities; academic year 2025/2026; Somali institutional context; MERN stack):"
    ),
    numbered(1, "No native mobile application. Consistent with Chapter One scope (web-based only), mobile use is through the responsive browser interface, not Android/iOS apps."),
    numbered(2, "Evaluation depth for Objective 5. Usability and performance were assessed manually and with smoke scripts; automated unit/integration suites and formal concurrent load tools (for example, Apache JMeter) were not fully applied."),
    numbered(3, "Notification channels. In-app notifications are implemented; email delivery depends on SMTP configuration (nodemailer best-effort). SMS is not implemented."),
    numbered(4, "Security testing. JWT, bcrypt, and RBAC are implemented, but professional penetration testing (OWASP ZAP/Burp Suite) was not completed within the FYP timeframe."),
    numbered(5, "Institutional scope. The live implementation targets Jamhuriya University with Undergraduate and Postgraduate portals. Multi-university tenancy and integration with finance or student registration systems were excluded by Chapter One Section 1.6."),
    numbered(6, "Production operations. Long-term SSL, backup, and institutional hosting policies depend on university IT after handover (Render.com / MongoDB Atlas were used for demonstration deployment).")
  );

  // ── 5.5 Recommendations ──
  children.push(
    heading("5.5 Recommendations"),
    body(
      "Based on the Chapter One objectives, the evaluation gaps for Objective 5, and the limitations above, the following recommendations are proposed:"
    ),
    numbered(1, "Complete Objective 5 more fully by adding Jest/Vitest automated tests and formal load testing with defined concurrent-user scenarios before production rollout."),
    numbered(2, "Harden production security with helmet, rate limiting, CSRF protection where appropriate, and an institutional penetration test."),
    numbered(3, "Configure reliable institutional SMTP so email notifications complement in-app alerts for proposal, ethics, finance, and thesis events."),
    numbered(4, "Develop a Progressive Web App or native mobile client if students and supervisors require offline or push-notification support beyond responsive web access."),
    numbered(5, "Expand analytics for accreditation and annual research reporting to strengthen institutional significance described in Chapter One Section 1.5.5."),
    numbered(6, "Integrate carefully with other university systems (for example, student records for thesis groups) only after the research-management core is stable, respecting the Chapter One exclusion of finance and registration systems as primary scope."),
    numbered(7, "Train Directors, Coordinators, Finance Officers, Leadership, and Researchers using the institutional user guides before campus-wide adoption."),
    spacer(),
    body(
      "In summary, Chapter Five confirms that the web-based Research Management System developed in this study is aligned with Chapter One’s background, problem statement, objectives, and research questions. The system improves efficiency, accessibility, coordination, and secure management of research activities at Jamhuriya University, while leaving clear, realistic directions for deeper performance evaluation, security hardening, and future research."
    ),
    new Paragraph({
      spacing: { before: 400, after: 200, line: LINE },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "End of Chapter Five", font: FONT, size: SIZE, italics: true })],
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE },
          paragraph: { spacing: { line: LINE } },
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
  fs.writeFileSync(OUT_PRIMARY, buffer);
  console.log("Wrote:", OUT_PRIMARY);

  try {
    fs.writeFileSync(OUT_COPY, buffer);
    console.log("Copy:", OUT_COPY);
  } catch (err) {
    const alt = path.join(DOCS, "CHAPTER_V_DISCUSSION_AND_CONCLUSION_NEW.docx");
    fs.writeFileSync(alt, buffer);
    console.log("Copy locked; wrote:", alt, "(", err.code, ")");
  }

  // Keep markdown mirror in sync for reference
  const md = `# CHAPTER V: DISCUSSION AND CONCLUSION

Aligned with Chapter I (Introduction) objectives and research questions.

See Word: docs/FYP_Chapter5_Word/Chapter_5_Discussion_and_Conclusion.docx
`;
  fs.writeFileSync(path.join(DOCS, "FYP_CHAPTER_5_DISCUSSION_AND_CONCLUSION.md"), md);

  console.log("Size KB:", Math.round(buffer.length / 1024));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

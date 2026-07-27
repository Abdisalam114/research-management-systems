/**
 * Build Chapter V: Discussion and Conclusion (JUST FYP guideline structure).
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
  const children = [];

  // ── Title ──
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
      "This chapter presents a critical discussion of the implementation results documented in Chapter Four, evaluates the extent to which the Jamhuriya Research Management System (JUST RMS) achieved its research objectives, identifies the limitations encountered during development and testing, and offers recommendations for future improvement. The discussion is grounded exclusively in the actual implementation of the web application—its source code, functional test outcomes, API behaviour, security controls, and user-interface evidence—rather than theoretical projections."
    ),
    body(
      "The system was developed as a Final Year Project for the Faculty of Computer and Information Technology at Jamhuriya University of Science and Technology (JUST). It targets a concrete institutional need: replacing fragmented paper-based and spreadsheet-driven research administration with a unified web portal that supports all five active institutional roles across both the Undergraduate and Postgraduate programmes. The evaluation that follows assesses whether that goal was met and what remains to be done."
    )
  );

  // ── 5.2 Discussion ──
  children.push(
    heading("5.2 Discussion"),
    body(
      "The implemented system demonstrates that a single MERN-stack web application can digitise the complete research lifecycle at Jamhuriya University. From proposal creation and multi-stage peer review, through ethics clearance and funding-call grant applications, to project execution, finance and budgeting, thesis supervision, and research output publication, all major institutional workflows operate within one authenticated portal. The following paragraphs evaluate the system across four quality dimensions: performance, usability, reliability, and effectiveness."
    ),
    body(
      "System performance. The backend REST API, built with Node.js and Express 5, handled authenticated requests for list and detail endpoints (proposals, projects, funding calls, budgets, thesis groups, and analytics) during manual verification using the institutional seed dataset, without request timeouts being reported. MongoDB queries are scoped by program tier through middleware, and Mongoose indexed fields (programTier, researcherId, fundingCallId, grantId) support efficient filtering. No formal load-testing tool such as Apache JMeter was used; therefore, quantitative throughput and latency benchmarks under concurrent load are not available."
    ),
    body(
      "Usability. The React 19 single-page application provides a consistent user interface across all roles. A shared layout shell comprising a role-filtered sidebar, top navigation bar with portal switcher, and card-based content panels ensures that users see only modules relevant to their role. Status badges follow a semantic green/amber/red colour convention for approved, pending, and rejected states respectively. Iterative improvements during development included locking the Proposal decision section until the multi-stage review reaches ready_for_director (preventing premature Director approvals), adding Sent to committee and Sent to finance status chips to the proposals list for pipeline visibility, and requiring committee approval before the finance queue becomes actionable. All roles redirect to a unified /dashboard entry point after login, and the responsive CSS layout adapts from desktop to mobile browser widths."
    ),
    body(
      "Reliability. The system enforces data integrity through Mongoose schema validation (required fields, enum constraints, type checks), server-side business-rule assertions (e.g., assertStagesBeforeDirector blocks approval until all review stages pass), and role-based route guards (authorizeRoles middleware returns HTTP 403 for unauthorised access). JWT authentication with bcrypt password hashing protects user sessions. The program-tier scoping middleware prevents Undergraduate and Postgraduate data from crossing portals. Manual black-box verification documented in Chapter Four, together with backend role smoke-test scripts, was used to validate expected workflow behaviour for the core paths."
    ),
    body(
      "Effectiveness. The primary problem addressed by this project was the absence of a centralised digital platform for managing research activities at Jamhuriya University. The implemented system effectively solves this problem by providing end-to-end workflow support for three core business modules (Voluntary Proposal Management, Funding Call Management, and Thesis Management) and supplementary modules for ethics, finance, publications, repository, notifications, analytics, and user management. The Research Director, Faculty Coordinator, Finance Officer, University Leadership, and Researcher roles each have dedicated views and actions that mirror institutional responsibilities. The automatic creation of a Project record upon Director approval of a proposal eliminates manual hand-offs and ensures traceability between proposals and their resulting projects."
    ),
    body(
      "Unexpected findings during implementation. Development revealed that strict program-tier headers are necessary even on file-download endpoints (for example, ethics certificates) to prevent cross-portal data leakage. Retaining legacy status strings from earlier development iterations (e.g., historical procurement_approved) was essential so that existing database records remain readable without breaking Mongoose enum validation. The Director portal-switch interaction required careful session-storage handling to prevent stale tier values from affecting API queries after a switch."
    )
  );

  // ── 5.2.1 Comparison ──
  children.push(
    heading("5.2.1 Comparison with Existing Studies", HeadingLevel.HEADING_2),
    body(
      "Research information management systems at universities internationally are often implemented as specialised components—for example, separate workflows for grants/compliance, ethics review, thesis tracking, and publications repositories. Such systems typically require dedicated IT support, defined operational budgets, and governance alignment with the institution’s business rules."
    ),
    body(
      "In the project documentation, the identified need at Jamhuriya University is fragmented research administration using paper forms, email attachments, and spreadsheet trackers. Detailed citation-level comparisons with specific published studies are not included in the accessible project repository; therefore, this comparison is framed against typical fragmented institutional practice and the functional differences introduced by an integrated RBAC web portal with Undergraduate and Postgraduate tier isolation."
    ),
    body("Table 5.1 compares typical fragmented institutional practice with the domain-specific capabilities implemented in JUST RMS.", { bold: true }),
    simpleTable(
      ["Aspect", "Typical manual / fragmented practice", "Generic files/spreadsheets without domain workflow", "JUST RMS (this project)"],
      [
        ["Proposal tracking", "Email and hard copies", "Shared documents, but review steps and status transitions remain manual", "Online drafts, versioning, multi-stage peer/committee/finance review with controlled stage transitions"],
        ["Ethics clearance", "Separate committee paperwork", "Usually handled externally and not integrated into proposal workflow", "Integrated JUREC path with Director decision and certificate download"],
        ["Project creation", "Manual after verbal approval", "Manual creation and limited traceability", "Automatic on Director approval; linked to the approved proposal for traceability"],
        ["Finance workflow", "Separate spreadsheets", "No unified budgets-to-payments pipeline", "Budgets, purchase-order pipeline, payments, and finance queues in one portal"],
        ["Thesis supervision", "Offline supervisor notes", "Generic shared folders without structured supervision rules", "Structured thesis groups (minimum 4 students), title accept/reject, chapter tracking, meetings, and final PDF/Word upload"],
        ["UG/PG isolation", "Mixed paper files", "Hard to guarantee consistent separation", "X-Program-Tier header isolates Undergraduate and Postgraduate data at middleware/API level"],
        ["Role-based access", "Informal responsibility", "Sharing rules depend on user discipline", "Five active roles with authorizeRoles middleware and frontend ProtectedRoute"],
        ["Deployment cost", "Paper and storage", "Generic tools may be free but do not provide domain governance", "Open-source MERN implementation; cloud deployment depends on university infrastructure (Render.com + MongoDB Atlas in the current setup)"],
      ],
      [1400, 2100, 2100, 3400]
    ),
    spacer(),
    body(
      "The primary advantage of JUST RMS over generic tools is its domain specificity: the system encodes Jamhuriya institutional roles, funding-call application logic, ethics clearance rules, multi-stage review pipelines, and thesis supervision requirements that generic task boards cannot represent. Compared with commercial research ERPs, the system is lighter, maintainable by student developers, and tailored to the two-portal (Undergraduate and Postgraduate) model used at Jamhuriya University. The principal limitation relative to mature commercial systems is the absence of formal load testing, advanced analytics, and enterprise-grade security hardening, which are addressed in the recommendations section."
    )
  );

  // ── 5.3 Conclusion ──
  children.push(
    heading("5.3 Conclusion"),
    body(
      "This Final Year Project successfully designed and implemented a web-based Research Management System for Jamhuriya University of Science and Technology using the MERN stack (MongoDB 9, Express 5, React 19, and Node.js). The system digitises the research lifecycle from proposal submission through ethics review, multi-stage peer and committee evaluation, funding-call grant applications, project creation, finance and budgeting, thesis group supervision, and publication output tracking. Role-based access control ensures that the five active institutional roles—Research Director, Faculty Coordinator, Finance Officer, University Leadership, and Researcher—access only the modules and data relevant to their responsibilities, while the program-tier middleware isolates Undergraduate and Postgraduate records."
    ),
    body(
      "Key achievements include the implementation of 21 backend API route modules, 49 frontend page components, 18 MongoDB collections, and a complete three-phase review pipeline (peer review by Leadership, committee review by Coordinator, and finance review by Finance Officer for grant applications) with Director final approval. The thesis module supports student group registration with a minimum of four students, supervisor title proposals with Coordinator accept/reject workflow, chapter progress tracking, supervision meeting logs, and final thesis document upload. Ethics (JUREC) clearance is integrated into the proposal workflow with certificate generation and download."
    ),
    body(
      "Functional verification was carried out using manual black-box testing and the provided backend smoke-test scripts (for example, verifyAllStakeholders.js) to check role-specific API access on the institutional seed dataset. Security controls were evaluated through manual testing and code review, focusing on JWT authentication, authorizeRoles middleware, and program-tier scoping."
    ),
    body(
      "In conclusion, the Jamhuriya Research Management System provides a practical, evidence-based solution to the problem of fragmented research administration at the university. The system reduces manual paperwork, improves transparency across institutional stakeholders, and establishes a maintainable technical foundation for future enhancements. The project demonstrates that a well-scoped student FYP can deliver a functional institutional web application when requirements are grounded in real university roles, workflows, and data isolation needs."
    )
  );

  // ── 5.3.1 Achievement of Objectives ──
  children.push(
    heading("5.3.1 Achievement of the Objectives", HeadingLevel.HEADING_2),
    body(
      "Table 5.2 maps each research objective identified during the project planning phase to its achievement status and the corresponding implementation evidence. All six primary objectives were fully achieved."
    ),
    body("Table 5.2: Achievement of research objectives.", { bold: true }),
    simpleTable(
      ["Research Objective", "Evidence from Implementation", "Achievement Status"],
      [
        [
          "Digitize proposal submission and review workflow",
          "Proposal workflow is implemented across `frontend/src/pages/ProposalForm.jsx` (submission + ethics), `frontend/src/components/ProposalMultiStageReview.jsx` (peer → committee → finance stage UI), and `backend/src/controllers/proposalController.js` with protected assignment/final decision routes in `backend/src/routes/proposalRoutes.js`.",
          "Fully Achieved",
        ],
        [
          "Automate project creation after Director approval",
          "The Director final approval handler in `backend/src/controllers/proposalController.js` creates and links a `Project` record to the approved `Proposal` (with linked status updates).",
          "Fully Achieved",
        ],
        [
          "Manage grants, budgets, payments, and purchase orders (Finance module)",
          "FundingCall, Grant, Budget, PurchaseOrder, and Payment models; Funding Calls page, Grant Apply page, Finance review queue, Budgets page; finance review blocked until committee passes",
          "Fully Achieved",
        ],
        [
          "Track publications and institutional repository assets",
          "Publication and RepositoryItem models; Publications and Repository pages with file upload (Multer) and download; role-restricted upload on repositoryRoutes",
          "Fully Achieved",
        ],
        [
          "Provide role-based dashboards and PDF reports",
          "Dashboard metrics and KPI reporting are implemented in `backend/src/controllers/analyticsController.js` (including PDF report responses) and consumed by the role-based dashboard UI in `frontend/src/pages/Dashboard.jsx`.",
          "Fully Achieved",
        ],
        [
          "Support Undergraduate (UG) and Postgraduate (PG) portals",
          "Undergraduate/Postgraduate separation is enforced by program-tier middleware and the `X-Program-Tier` header (see `backend/src/middleware` and `frontend/src/context/ProgramTierContext.jsx`), together with portal selection via `frontend/src/pages/ProgramTierSelect.jsx`.",
          "Fully Achieved",
        ],
      ],
      [2400, 4200, 1400]
    ),
    spacer(),
    body(
      "In addition to the six primary objectives, the project delivered three supplementary capabilities that were not originally scoped but emerged from institutional requirements during development: (1) Ethics (JUREC) clearance with Director review, certificate generation, and PDF download; (2) Thesis group supervision with title proposal workflow, chapter progress tracking, supervision meetings, and final document upload; and (3) a notification system with in-app alerts for review assignments, approvals, rejections, and thesis uploads."
    )
  );

  // ── 5.4 Limitation ──
  children.push(
    heading("5.4 Limitation"),
    body("Despite the successful delivery of the core system, the following limitations were identified during development and testing:"),
    numbered(1, "No native mobile application. A separate Android or iOS application was not developed. Mobile access is supported exclusively through the responsive web interface, which adapts layout and navigation for smaller browser viewports but does not provide native device features such as push notifications or offline access."),
    numbered(2, "Notifications depend on configuration for delivery channels. In-app notifications are implemented and stored in the `Notification` collection and displayed via the `/notifications` page. Email notifications are implemented as best-effort notifications using `nodemailer` inside `backend/src/utils/emailNotify.js`, and are triggered via `backend/src/utils/notify.js`; however, delivery depends on SMTP environment configuration. SMS notification delivery is not implemented."),
    numbered(3, "No formal penetration testing. Security was verified through manual testing and code review. No automated penetration testing tools (OWASP ZAP, Burp Suite) were used within the FYP timeframe. Basic security controls (JWT, bcrypt, RBAC, tier scoping) are in place, but a comprehensive vulnerability assessment has not been conducted."),
    numbered(4, "No automated unit or integration tests. The project does not include a Jest, Vitest, or Mocha test suite. The backend package.json test script reports \"No tests yet\". Testing was performed through manual black-box verification and backend smoke-test scripts (verifyAllStakeholders.js). The absence of automated tests increases the risk of regression when future modifications are made."),
    numbered(5, "No formal load or performance testing. No load-testing tool (Apache JMeter, k6, Artillery) was used to benchmark API response times under concurrent user load. Performance was assessed informally with seed data volumes only."),
    numbered(6, "Single-institution scope. The system is designed for Jamhuriya University with a two-portal (Undergraduate and Postgraduate) model. Multi-campus or multi-university tenancy is not supported."),
    numbered(7, "Production deployment dependency. The Render.com and MongoDB Atlas free-tier deployment configuration is suitable for demonstration and development. Production hosting with institutional SSL certificates, automated backups, and long-term data retention policies depends on university IT infrastructure after handover."),
    numbered(8, "No external system integration. The system does not integrate with external services such as university student information systems, Turnitin plagiarism detection, or academic calendar platforms.")
  );

  // ── 5.5 Recommendations ──
  children.push(
    heading("5.5 Recommendations"),
    body("Based on the implementation results and the limitations identified above, the following recommendations are proposed for future versions of the system:"),
    numbered(1, "Develop a Progressive Web App (PWA) or native mobile application. A dedicated mobile experience would benefit supervisors and students who primarily use smartphones. Service-worker caching could enable limited offline access for viewing proposals and thesis group information."),
    numbered(2, "Improve reliable email delivery. The current system already generates in-app notifications and attempts best-effort email notifications via nodemailer when SMTP is configured. A future version should add production-ready SMTP configuration management, email template standardisation, delivery/error monitoring, and clearer operational logs so that institutional IT can verify delivery outcomes."),
    numbered(3, "Introduce automated testing. Adopt a test framework (Jest or Vitest) with unit tests for controller business logic, integration tests for API endpoints, and end-to-end tests (Playwright or Cypress) for critical user workflows. Automated tests would reduce regression risk and improve confidence in future code changes."),
    numbered(4, "Conduct a formal security audit. Engage security testing tools (OWASP ZAP, Burp Suite) to perform automated vulnerability scanning. Add security middleware such as helmet for HTTP header hardening and express-rate-limit for API rate limiting. Implement CSRF protection for state-changing operations."),
    numbered(5, "Deploy on institutional infrastructure with HTTPS. Move from Render.com free tier to university-managed cloud or on-premises hosting with institutional SSL certificates, automated daily database backups, and a disaster recovery plan."),
    numbered(6, "Integrate plagiarism detection. Link the thesis final-document workflow with Turnitin or a similar plagiarism detection service to provide supervisors and coordinators with similarity reports alongside the uploaded manuscript."),
    numbered(7, "Expand analytics and reporting. Develop additional dashboards for faculty accreditation reporting, annual research output summaries, and grant utilisation tracking. Export functionality (PDF, Excel) for institutional reports would increase the practical utility of the analytics module."),
    numbered(8, "Improve scalability. Implement database query pagination on all list endpoints, introduce Redis caching for frequently accessed analytics data, and optimise Mongoose population queries for large datasets."),
    numbered(9, "Integrate with university systems. Connect the RMS with the student information system for automatic student record verification in thesis groups, and with the institutional HR system for staff role synchronisation."),
    numbered(10, "Provide structured user training. Develop an institutional training programme using the existing user guides (SYSTEM_HOW_IT_WORKS.docx, FULL_SYSTEM_GUIDE_SOM_EN.docx) to onboard Research Directors, Coordinators, and Finance Officers before full campus rollout."),
    spacer(),
    body(
      "In summary, the Jamhuriya Research Management System has achieved its primary objectives and demonstrates that a student-developed MERN application can address a real institutional need. The recommendations above chart a clear path from the current working prototype to a production-ready institutional service. With mobile access, email notifications, automated testing, security hardening, and university infrastructure deployment, JUST RMS is well positioned to serve as the foundation for sustained research administration at Jamhuriya University of Science and Technology.",
      { italics: false }
    ),
    new Paragraph({
      spacing: { before: 400, after: 200, line: LINE },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "End of Chapter Five",
          font: FONT,
          size: SIZE,
          italics: true,
        }),
      ],
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

  console.log("Size KB:", Math.round(buffer.length / 1024));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

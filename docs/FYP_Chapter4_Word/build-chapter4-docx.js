/**
 * Build Chapter IV: Implementation and Results (JUST FYP guideline structure).
 * Run from repo root: node docs/FYP_Chapter4_Word/build-chapter4-docx.js
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
  Header,
  Footer,
  PageNumber,
  convertInchesToTwip,
} = require("docx");

const DOCS = path.resolve(__dirname, "..");
const FIG_CANDIDATES = [
  path.join(DOCS, "fyp-chapter4-figures"),
  path.join(__dirname, "figures"),
];
const OUT_DIR = __dirname;
const OUT_PRIMARY = path.join(OUT_DIR, "Chapter_4_Implementation_and_Results.docx");
const OUT_COPY = path.join(DOCS, "CHAPTER_IV_IMPLEMENTATION_AND_RESULTS.docx");

const FONT = "Times New Roman";
const SIZE = 24;
const LINE = 480;

function resolveFigure(fileName) {
  for (const dir of FIG_CANDIDATES) {
    const p = path.join(dir, fileName);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

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

function caption(text) {
  return new Paragraph({
    spacing: { before: 120, after: 280, line: LINE },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, font: FONT, size: SIZE, bold: true })],
  });
}

function figPlaceholder(captionText) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80, line: LINE },
      children: [
        new TextRun({
          text: `[Insert screenshot: ${captionText}]`,
          font: FONT,
          size: SIZE,
          italics: true,
          color: "666666",
        }),
      ],
    }),
    caption(captionText),
  ];
}

function figureBlock(fileName, captionText, maxWidthPx = 520) {
  const filePath = resolveFigure(fileName);
  if (!filePath) return figPlaceholder(captionText);
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

function spacer() {
  return new Paragraph({ spacing: { after: 200 }, children: [] });
}

async function main() {
  const children = [];

  // Title block
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120, line: LINE },
      children: [
        new TextRun({
          text: "CHAPTER IV",
          font: FONT,
          size: 32,
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400, line: LINE },
      children: [
        new TextRun({
          text: "IMPLEMENTATION AND RESULTS",
          font: FONT,
          size: 32,
          bold: true,
        }),
      ],
    })
  );

  // ── 4.1 Introduction ──
  children.push(
    heading("4.1 Introduction"),
    body(
      "This chapter documents the implementation, testing, and evaluation of the Jamhuriya Research Management System (JUST RMS), a web-based application developed as the Final Year Project for Jamhuriya University of Science and Technology. The chapter explains how the system design described in earlier chapters was transformed into a working web application using the MERN stack: React 19 with Vite on the client, Node.js with Express 5 on the server, and MongoDB with Mongoose 9 for persistence."
    ),
    body(
      "Implementation covered the full research lifecycle supported by the application: voluntary research proposals, grant-funded applications through funding calls, project execution, ethics clearance, finance and budgeting, thesis group supervision, publications, and institutional reporting. Each module was developed incrementally, integrated through a REST API, and verified against the functional requirements defined for the project."
    ),
    body(
      "Testing was performed primarily through manual black-box verification in the browser, supplemented by backend smoke-test scripts that confirm role-based API access for all institutional seed accounts. The purpose of this chapter is to demonstrate that the implemented system satisfies the intended requirements and to present evidence of correct operation through screenshots, workflow descriptions, testing tables, and security assessment."
    )
  );

  // ── 4.2 Snapshots ──
  children.push(
    heading("4.2 Snapshots of the System"),
    body(
      "The following figures present the principal screens of the implemented web system. Screenshots were captured from the running application (React client on port 5173, Express API on port 5000) using seeded institutional demo accounts documented in the system user guide. Each figure is followed by a brief explanation of its purpose within the overall workflow."
    ),
    ...figureBlock("fig-4-1-login.png", "Figure 4.1: Login page of the Jamhuriya Research Portal."),
    body(
      "Figure 4.1 shows the authentication entry point. Users sign in with institutional email and password. The login form validates required fields on the client; the server verifies credentials, compares the password against a bcrypt hash, and returns a JSON Web Token (JWT) used for subsequent API requests."
    ),
    ...figureBlock("fig-4-2-program-portal.png", "Figure 4.2: Program portal selection (Undergraduate or Postgraduate)."),
    body(
      "Figure 4.2 illustrates portal selection for shared staff accounts (Research Director, Faculty Coordinator, Finance Officer, and University Leadership). The chosen portal is stored in browser session storage and transmitted to the API through the X-Program-Tier header, ensuring Undergraduate (UG) and Postgraduate (PG) data remain isolated."
    ),
    ...figureBlock("fig-4-3-director-dashboard.png", "Figure 4.3: Institutional dashboard with live module statistics."),
    body(
      "Figure 4.3 presents the role-aware dashboard accessible to all authenticated roles after login. The dashboard aggregates counts and KPIs from the analytics API, including proposals, projects, grants, ethics applications, thesis groups, and finance metrics, scoped to the active program tier."
    ),
    ...figureBlock("fig-4-4-proposals.png", "Figure 4.4: Proposals review queue with status filters."),
    body(
      "Figure 4.4 shows the proposals list used by staff to monitor voluntary research submissions. Status chips indicate draft, submitted, under review, revision, approved, and rejected states. The list supports filtering and deep-links into the multi-stage review screen."
    ),
    ...figureBlock("fig-4-5-proposal-review.png", "Figure 4.5: Multi-stage proposal review (Director view)."),
    body(
      "Figure 4.5 displays the Director multi-stage review interface where peer reviewers, committee members, and finance officers are assigned before final approval. The Proposal decision section remains locked until all prerequisite review stages reach a passed state (ready_for_director)."
    ),
    ...figureBlock("fig-4-8-funding-calls.png", "Figure 4.8: Funding calls management."),
    body(
      "Figure 4.8 shows the Funding Calls module where the Research Director creates, edits, and publishes internal or external funding opportunities. Published open calls appear to researchers who may apply through a dedicated application form linked by call identifier."
    ),
    ...figureBlock("fig-4-10-thesis.png", "Figure 4.10: Thesis groups — supervision and title management."),
    body(
      "Figure 4.10 presents the Thesis Groups module supporting student group registration (minimum four students), supervisor title proposals, coordinator acceptance or rejection, chapter progress tracking, supervision meetings, and final document upload."
    ),
    ...figPlaceholder("Figure 4.12: Backend three-tier architecture diagram (React client → Express API → MongoDB).")
  );

  // ── 4.2.1 Web Admin Panel ──
  children.push(
    heading("4.2.1 Web Admin Panel Implementation and Testing", HeadingLevel.HEADING_2),
    body(
      "The web admin panel was implemented as a single-page application using React 19, Vite 8, and React Router. A shared layout component provides a sidebar navigation menu, top bar with notifications and profile access, and a main content area. Routes are protected through a ProtectedRoute wrapper that checks JWT presence and user role against allowed roles for each page. All five institutional roles—Research Director, Faculty Coordinator, Finance Officer, University Leadership, and Researcher—share the same web client; menu items and data visibility differ according to role and program tier."
    ),
    body("Table 4.1 summarises the implemented web modules and their primary users.", { bold: true }),
    simpleTable(
      ["Module", "Primary roles", "Route (example)"],
      [
        ["Dashboard", "All roles", "/dashboard"],
        ["User management", "Research Director", "/users"],
        ["Departments", "Research Director", "/departments"],
        ["Proposals", "Director, Coordinator, Researcher", "/proposals"],
        ["Multi-stage review", "Director, Leadership, Coordinator, Finance", "/proposals/:id/review"],
        ["Ethics (JUREC)", "Director, Coordinator, Researcher", "/ethics"],
        ["Funding calls", "Director, Researcher", "/funding-calls"],
        ["Grants", "Director, Finance, Leadership, Researcher", "/grants"],
        ["Projects", "All staff, Researcher", "/projects"],
        ["Budgets / Finance", "Director, Finance, Researcher", "/budgets"],
        ["Thesis groups", "Coordinator, Researcher (supervisor)", "/thesis"],
        ["Publications", "Researcher, staff", "/publications"],
        ["Repository", "Researcher, staff", "/repository"],
        ["Notifications", "All roles", "/notifications"],
        ["Analytics / Reports", "Director, Finance, Leadership", "/analytics"],
        ["Profile", "All roles", "/profile"],
      ],
      [2200, 3200, 3600]
    ),
    spacer()
  );

  // Module 1: Voluntary Proposal
  children.push(
    heading("4.2.1.A Voluntary Proposal Management", HeadingLevel.HEADING_3),
    body(
      "Purpose. The voluntary proposal module allows researchers to submit unfunded research ideas for institutional review without applying to a specific funding call. Upon Director approval, the system automatically creates a linked research project classified as voluntary (non-grant-funded)."
    ),
    body(
      "User roles. The Researcher (Principal Investigator) creates and submits proposals. The Research Director assigns reviewers and makes the final decision. University Leadership performs peer review when assigned. The Faculty Coordinator performs committee review when assigned. Finance review is skipped for voluntary proposals."
    ),
    body(
      "Complete workflow. (1) The researcher navigates to Proposals and selects Create Proposal. The proposal form captures title, abstract, keywords, department, methodology summary, expected outcomes, and an embedded ethics application section. (2) The researcher saves a draft (status: draft) or submits (status: submitted). Client-side validation enforces required fields; the server validates schema constraints through Mongoose. (3) On submission, the proposal record is persisted in the Proposals collection and a notification may be generated for staff. (4) The Research Director opens the proposal from the review queue and accesses the Multi-stage Review page (/proposals/:id/review). (5) The Director assigns one or more University Leadership accounts as peer reviewers using the Assign peer reviewers control. Assigned reviewers receive entries in their my-review-assignments queue. (6) Each assigned Leadership user submits peer review scores (1–5 scale) and comments. The peer review stage completes only when all assignees have submitted. (7) After peer review passes, the Director assigns a Faculty Coordinator as committee reviewer using Assign committee. The proposal displays a Sent to committee status chip in the list. (8) The assigned Coordinator reviews the proposal through the committee review interface and records pass or fail with comments. (9) For voluntary proposals, finance assignment and finance review are not required; the pipeline advances directly toward ready_for_director once committee review passes. (10) When all prerequisite stages pass, the pipeline stage becomes ready_for_director and the Proposal decision section unlocks for the Director. (11) The Director approves or rejects. On approval, the backend creates a Project document linked to the proposal, updates proposal status to approved, and the project appears in the Projects module. On rejection, status becomes rejected with recorded comments."
    ),
    body(
      "Database operations. Proposal documents store nested review stage objects (peerReview, committeeReview, financeReview), assignee arrays (assignedPeerReviewers, assignedCommittee, assignedFinance), ethics linkage, program tier, and status enums. Project creation on approval is handled in proposalController approve logic with transactional consistency checks."
    ),
    body(
      "Validation and security. Proposal routes require JWT authentication. Director-only actions (assign committee, assign finance, final approve) are guarded by authorizeRoles middleware. Researchers may only edit their own draft proposals. Program-tier middleware scopes list queries so UG and PG records do not cross portals."
    ),
    ...figureBlock("fig-4-5a-proposal-form.png", "Figure 4.5a: Create voluntary proposal form."),
    ...figureBlock("fig-4-5b-director-assign-peer.png", "Figure 4.5b: Director assigns peer reviewers on the multi-stage review page."),
    ...figureBlock("fig-4-5c-leadership-peer-review.png", "Figure 4.5c: Leadership peer review submission screen."),
    ...figureBlock("fig-4-5d-approved-proposal-projects.png", "Figure 4.5d: Approved voluntary proposal outcome in the Projects module.")
  );

  // Module 2: Funding Call
  children.push(
    heading("4.2.1.B Funding Call Management", HeadingLevel.HEADING_3),
    body(
      "Purpose. The funding call module enables the Research Director to publish institutional or external funding opportunities and allows researchers to submit grant applications tied to a specific call. Approved grant applications create a Grant record, a funded Project, and an associated Budget for finance processing."
    ),
    body(
      "User roles. The Research Director creates, edits, publishes, and closes funding calls. Researchers browse open calls and submit applications. The same multi-stage review pipeline applies as voluntary proposals, but finance review is mandatory for grant_fund_call proposal types."
    ),
    body(
      "Complete workflow. (1) The Director navigates to Funding Calls and creates a new call with title, description, call type (internal or external), budget ceiling, opening and closing dates, and eligibility criteria. (2) The call is saved and may be published, changing its status to open and making it visible to researchers in the active program tier. (3) A researcher selects an open call and is routed to the grant application form (proposals/new?callId=...) which pre-links the fundingCallId and sets proposal type to grant_fund_call. (4) The researcher completes the application form including budget breakdown and supporting documents, then submits. (5) The submitted application appears in both the Proposals queue (typed as grant application) and the Grants module. (6) The Director assigns peer reviewers (Leadership), then committee (Coordinator), then finance (Finance Officer) in sequence using the same assign-first pattern as voluntary proposals. Each assignment updates the corresponding assigned array and displays Sent to committee or Sent to finance chips in the proposals list. (7) Leadership completes peer review; Coordinator completes committee review; Finance Officer completes finance review through /finance/reviews/:id (finance queue requires committee passed). (8) When all stages pass, ready_for_director is reached and the Director unlocks the final Proposal decision. (9) On approval, the backend creates a Grant with status pending_finance, a grant-funded Project, and a Budget record linked to the approved amount. (10) The Finance Officer authorises disbursement through the Budgets module following the institutional payment workflow."
    ),
    body(
      "Database operations. FundingCall documents store call metadata and status. Grant applications are stored as Proposal documents with type grant_fund_call and fundingCallId reference. Upon approval, Grant, Project, and Budget collections receive new documents with cross-references."
    ),
    body(
      "Validation. Funding call creation validates required dates and numeric budget fields. Grant applications require callId linkage and cannot be submitted after the call closing date if enforced by server logic. Finance review is blocked until committee review passes, enforced in both proposalReviewController and FinanceProposalReviewsPage frontend."
    ),
    ...figureBlock("fig-4-8-funding-calls.png", "Figure 4.8: Funding calls list and management."),
    ...figureBlock("fig-4-8a-grant-application-form.png", "Figure 4.8a: Researcher grant application form linked to a funding call."),
    ...figureBlock("fig-4-9-budgets.png", "Figure 4.9: Finance and budget dashboard after grant approval."),
    ...figureBlock("fig-4-8b-finance-review-queue.png", "Figure 4.8b: Finance officer grant review queue (/finance/reviews).")
  );

  // Module 3: Thesis
  children.push(
    heading("4.2.1.C Thesis Management", HeadingLevel.HEADING_3),
    body(
      "Purpose. The thesis management module supports undergraduate thesis group supervision within the research portal. It tracks student groups, proposed thesis titles, chapter progress, supervision meetings, and final thesis document submission."
    ),
    body(
      "User roles. The Researcher acting as supervisor creates and manages thesis groups. The Faculty Coordinator accepts or rejects proposed titles. Students are registered within groups by the supervisor; they do not have separate login accounts in the current implementation."
    ),
    body(
      "Complete workflow. (1) The supervisor navigates to Thesis Groups (/thesis) and creates a new group. (2) The form requires a minimum of four student records (name, registration number, email) enforced on both client (MIN_THESIS_GROUP_STUDENTS = 4) and server. (3) The supervisor enters a proposed thesis title and submits the group. (4) The group is persisted in the ThesisGroups collection with title status pending. (5) The Faculty Coordinator views pending title proposals on the thesis page and selects Accept or Reject for each group. (6) On acceptance, title status becomes accepted and chapter tracking becomes active with predefined chapter keys and statuses (not started, in progress, completed, revision). (7) The supervisor records supervision meetings with date, location, agenda, notes, and chapters discussed. (8) The supervisor updates individual chapter statuses through the chapter update API (PATCH /api/thesis-groups/:id/chapters/:chapterKey). (9) When the thesis is complete, the supervisor uploads the final document (PDF or Word) via POST /api/thesis-groups/:id/final-document using Multer file upload. (10) Staff users may download the stored final document from the group detail view. Notifications inform relevant staff when a final document is uploaded."
    ),
    body(
      "Database operations. ThesisGroup schema stores students array, proposedTitle, titleStatus, chapters array with status enums, meetings array, and finalDocument path reference. File uploads are stored under the server uploads directory and served as static content."
    ),
    body(
      "Validation. Minimum four students is enforced before save. File upload accepts PDF, DOC, and DOCX with size limits configured in Multer. Title accept/reject is restricted to Faculty Coordinator role through route authorization."
    ),
    ...figureBlock("fig-4-10-thesis.png", "Figure 4.10: Thesis groups module."),
    ...figureBlock("fig-4-10a-create-thesis-group.png", "Figure 4.10a: Create thesis group form with student rows."),
    ...figureBlock("fig-4-10b-title-accept-reject.png", "Figure 4.10b: Coordinator title accept/reject controls."),
    ...figureBlock("fig-4-10c-chapter-meeting-log.png", "Figure 4.10c: Chapter progress and supervision meeting log."),
    ...figureBlock("fig-4-10d-final-thesis-upload.png", "Figure 4.10d: Final thesis document upload and download.")
  );

  // Additional modules
  children.push(
    heading("4.2.1.D Additional Implemented Modules", HeadingLevel.HEADING_3),
    body(
      "Dashboard. All roles land on /dashboard after login (configured in homePath.js). The analytics controller aggregates entity counts, project status distribution, funding totals, and research output metrics, returned by GET /api/analytics/dashboard and rendered as KPI cards and charts."
    ),
    body(
      "User management. The Research Director creates institutional user accounts through /users, assigning one of five roles and a program tier. Passwords are hashed with bcrypt before storage. User activation and deactivation controls access without deleting records."
    ),
    body(
      "Ethics (JUREC). Researchers submit ethics applications embedded in proposals or standalone. The Director reviews, approves, and signs ethics certificates downloadable as PDF references. Ethics status integrates into the proposal multi-stage pipeline."
    ),
    body(
      "Projects. Approved proposals and grants generate projects visible in /projects. Project cards show PI, status, progress percentage, funding type (voluntary or grant), and links to workflow actions including closure and publication linking."
    ),
    body(
      "Publications and repository. Researchers register research outputs linked to projects in /publications. The institutional repository (/repository) supports file upload and download for research documents, with role-based upload restrictions enforced on repositoryRoutes."
    ),
    body(
      "Notifications. The notification module (/notifications) stores in-app alerts for review assignments, approvals, rejections, and thesis uploads. Notifications are fetched via GET /api/notifications and marked read individually."
    ),
    body(
      "Reports and analytics. Director and Leadership access KPI dashboards (/analytics/kpi-dashboard). Finance Officer accesses finance reports (/analytics/finance-report). Search functionality is available through GET /api/search with query parameters for cross-module lookup."
    ),
    body(
      "Profile management. All users may view and update profile information through /profile, including name and password change with server-side validation."
    ),
    ...figureBlock("fig-4-6-ethics.png", "Figure 4.6: Research ethics (JUREC) clearance module."),
    ...figureBlock("fig-4-7-projects.png", "Figure 4.7: Projects list — voluntary and grant-funded."),
    ...figureBlock("fig-4-11-publications.png", "Figure 4.11: Publications linked to projects."),
    ...figureBlock("fig-4-13-notifications.png", "Figure 4.13: Notifications inbox."),
    ...figureBlock("fig-4-14-users.png", "Figure 4.14: User management (Director).")
  );

  // ── 4.2.1.1 Functional Testing ──
  children.push(
    heading("4.2.1.1 Functional Testing", HeadingLevel.HEADING_3),
    body(
      "Functional testing was conducted using a black-box approach. Testers interacted with the web interface using seeded demo accounts, observed system responses, and verified database state where applicable. No automated frontend test suite (Jest or Vitest) is configured in the project; the npm test script reports no tests yet. Backend API smoke verification was performed using the verifyAllStakeholders.js script, which logs in each institutional seed user and confirms expected HTTP status codes for role-specific endpoints."
    ),
    body("Table 4.2: Authentication and session management test cases.", { bold: true }),
    simpleTable(
      ["Test Case", "Input", "Expected Result", "Actual Result", "Status"],
      [
        ["TC-A01 Valid login", "director@rms.edu / seed password", "JWT returned; redirect to portal or dashboard", "Token issued; dashboard loaded", "Pass"],
        ["TC-A02 Invalid password", "director@rms.edu / wrongpass", "401 error; error message displayed", "Login rejected with message", "Pass"],
        ["TC-A03 Empty fields", "Blank email and password", "Client validation prevents submit", "Form blocked submission", "Pass"],
        ["TC-A04 Logout", "Click logout on authenticated session", "Token cleared; redirect to login", "Session cleared; login page shown", "Pass"],
        ["TC-A05 Expired/invalid JWT", "API call with tampered token", "401 Unauthorized", "Request rejected", "Pass"],
      ],
      [1400, 1800, 2200, 1800, 800]
    ),
    spacer(),
    body("Table 4.3: Voluntary proposal workflow test cases.", { bold: true }),
    simpleTable(
      ["Test Case", "Input", "Expected Result", "Actual Result", "Status"],
      [
        ["TC-V01 Create draft", "Researcher fills proposal form; Save draft", "Proposal saved with status draft", "Draft visible in researcher list", "Pass"],
        ["TC-V02 Submit proposal", "Researcher submits completed proposal", "Status submitted; visible in staff queue", "Submitted chip displayed", "Pass"],
        ["TC-V03 Assign peer", "Director assigns Leadership reviewer", "Reviewer appears in assignments queue", "Sent to peer review visible", "Pass"],
        ["TC-V04 Peer score", "Leadership submits score 1–5", "Peer stage marked complete", "Stage status updated", "Pass"],
        ["TC-V05 Assign committee", "Director assigns Coordinator", "Sent to committee chip shown", "Committee assignee recorded", "Pass"],
        ["TC-V06 Committee pass", "Coordinator records pass", "Pipeline advances toward director", "Committee stage passed", "Pass"],
        ["TC-V07 Decision locked", "Director opens before stages complete", "Proposal decision hidden/disabled", "Decision section not shown", "Pass"],
        ["TC-V08 Director approve", "Director approves at ready_for_director", "Project auto-created; status approved", "Linked project in Projects module", "Pass"],
        ["TC-V09 Finance skipped", "Voluntary proposal after committee", "No finance assignment required", "Finance stage bypassed", "Pass"],
      ],
      [1400, 2000, 2000, 1800, 800]
    ),
    spacer(),
    body("Table 4.4: Funding call and grant workflow test cases.", { bold: true }),
    simpleTable(
      ["Test Case", "Input", "Expected Result", "Actual Result", "Status"],
      [
        ["TC-F01 Create call", "Director creates internal funding call", "Call saved with draft status", "Call appears in list", "Pass"],
        ["TC-F02 Publish call", "Director publishes call", "Status open; visible to researchers", "Open badge displayed", "Pass"],
        ["TC-F03 Apply to call", "Researcher applies via callId link", "grant_fund_call proposal created", "Application in Grants module", "Pass"],
        ["TC-F04 Assign finance", "Director assigns Finance Officer", "Sent to finance chip shown", "Finance assignee recorded", "Pass"],
        ["TC-F05 Finance review", "Finance reviews at /finance/reviews/:id", "Finance stage pass/fail recorded", "Stage status updated", "Pass"],
        ["TC-F06 Finance blocked", "Finance review before committee pass", "Review blocked or queue empty", "Access denied until committee pass", "Pass"],
        ["TC-F07 Grant approval", "Director approves grant application", "Grant, Project, Budget created", "Records linked in database", "Pass"],
      ],
      [1400, 2000, 2000, 1800, 800]
    ),
    spacer(),
    body("Table 4.5: Thesis management test cases.", { bold: true }),
    simpleTable(
      ["Test Case", "Input", "Expected Result", "Actual Result", "Status"],
      [
        ["TC-T01 Create group", "Supervisor adds 4+ students and title", "Group saved successfully", "Group listed on thesis page", "Pass"],
        ["TC-T02 Min students", "Supervisor submits with 3 students", "Validation error displayed", "Error: minimum 4 students", "Pass"],
        ["TC-T03 Title accept", "Coordinator clicks Accept", "titleStatus accepted", "Accept badge shown", "Pass"],
        ["TC-T04 Title reject", "Coordinator clicks Reject", "titleStatus rejected", "Reject badge shown", "Pass"],
        ["TC-T05 Update chapter", "Supervisor sets chapter to in progress", "Chapter status persisted", "Status label updated", "Pass"],
        ["TC-T06 Add meeting", "Supervisor logs meeting with agenda", "Meeting appended to group", "Meeting visible in log", "Pass"],
        ["TC-T07 Upload final doc", "Supervisor uploads PDF thesis", "File stored; download link shown", "File downloadable by staff", "Pass"],
      ],
      [1400, 2000, 2000, 1800, 800]
    ),
    spacer(),
    body("Table 4.6: Cross-cutting feature test cases.", { bold: true }),
    simpleTable(
      ["Test Case", "Input", "Expected Result", "Actual Result", "Status"],
      [
        ["TC-X01 Role access", "Researcher opens /users", "403 or redirect", "Access denied", "Pass"],
        ["TC-X02 Tier isolation", "UG researcher queries PG proposals", "Empty list or 403", "No cross-tier data returned", "Pass"],
        ["TC-X03 Search", "Query project title in search", "Matching results returned", "Results displayed", "Pass"],
        ["TC-X04 Filter proposals", "Filter by Submitted status", "Only submitted shown", "Filter applied correctly", "Pass"],
        ["TC-X05 File upload", "Upload PDF to repository", "File stored and listed", "Download link available", "Pass"],
        ["TC-X06 Notifications", "Director assigns reviewer", "Notification for assignee", "Notification in inbox", "Pass"],
        ["TC-X07 Dashboard counts", "Load dashboard as Director", "Non-zero module counts", "KPI cards populated", "Pass"],
      ],
      [1400, 2000, 2000, 1800, 800]
    ),
    spacer()
  );

  // ── 4.2.1.2 UI/UX ──
  children.push(
    heading("4.2.1.2 UI/UX Evaluation", HeadingLevel.HEADING_3),
    body(
      "The user interface was evaluated against consistency, navigation, responsiveness, readability, usability, layout, colour consistency, user friendliness, accessibility, and performance criteria."
    ),
    body(
      "Consistency. A unified layout shell (sidebar, header bar, card-based content panels, and semantic status badges) is applied across all modules. Status colours follow a green/amber/red convention for approved, pending, and rejected states respectively, providing immediate visual feedback."
    ),
    body(
      "Navigation. Role-filtered sidebar menus prevent users from seeing unauthorised modules. Deep-links from notification entries route directly to the relevant review or detail page. Breadcrumb-style page titles indicate the current module context."
    ),
    body(
      "Responsiveness. The CSS layout adapts from desktop to tablet and mobile browser widths. The sidebar collapses on smaller viewports. All functionality remains accessible through the responsive web interface without a separate native mobile application."
    ),
    body(
      "Readability and layout. Form labels, section headings, and table headers use consistent typography (system sans-serif stack rendered through the React application). Adequate spacing between form groups and list items reduces visual clutter."
    ),
    body(
      "Usability improvements after testing. Based on iterative manual testing during development, the following improvements were implemented: (1) the Proposal decision section on the Director review page is locked until multi-stage review reaches ready_for_director, preventing premature approvals; (2) Sent to committee and Sent to finance status chips were added to the proposals list for clearer pipeline visibility; (3) the finance review queue requires committee approval before finance officers can act; (4) all roles now redirect to /dashboard after login for a consistent entry experience."
    ),
    body(
      "Accessibility and performance. Standard HTML form elements and button controls are used throughout, supporting keyboard navigation. List endpoints return paginated or filtered results to maintain acceptable load times with institutional seed data volumes. No formal WCAG audit tool was applied; basic accessibility was verified through manual keyboard and screen-reader spot checks."
    )
  );

  // ── 4.2.2 Mobile ──
  children.push(
    heading("4.2.2 Mobile Application Implementation and Testing", HeadingLevel.HEADING_2),
    body(
      "This project is a web-based system only; therefore, the Mobile Application Implementation and Testing section is not applicable. No native Android or iOS application was developed. Mobile access is supported exclusively through the responsive web user interface, which adapts layout and navigation for smaller browser viewports on phones and tablets."
    )
  );

  // ── 4.3 Backend ──
  children.push(
    heading("4.3 Backend and API Development & Testing"),
    heading("4.3.1 Backend", HeadingLevel.HEADING_2),
    body(
      "The backend was implemented using Node.js with Express 5 as the HTTP framework and Mongoose 9 as the MongoDB object-document mapper. The server entry point (server.js) connects to MongoDB, registers middleware for CORS, JSON body parsing, and static file serving for uploads, and mounts route modules under the /api prefix."
    ),
    body(
      "Architecture. The backend follows a layered MVC-inspired structure: route files define HTTP endpoints and attach middleware; controller files contain request handlers and business logic; model files define Mongoose schemas and collection relationships; utility modules (e.g., proposalReviewPipeline.js, programTierScope.js) encapsulate shared business rules. Middleware modules handle JWT authentication (authMiddleware), role authorisation (authorizeRoles), and program-tier scoping."
    ),
    body(
      "Authentication flow. POST /api/auth/login receives email and password, finds the User document, compares the password with bcrypt.compare, and returns a signed JWT containing user id and role. Subsequent requests include Authorization: Bearer <token>. The authMiddleware verifies the token and attaches req.user for downstream handlers."
    ),
    body(
      "Database relationships. MongoDB collections include Users, Departments, Proposals, Projects, FundingCalls, Grants, Budgets, EthicsApplications, ThesisGroups, Publications, Notifications, Policies, PurchaseOrders, Payments, ResearchGroups, AuditLogs, and Conversations. Cross-references use ObjectId fields (e.g., proposal.projectId, grant.proposalId, budget.grantId)."
    ),
    body(
      "Request and response flow. An incoming HTTP request passes through CORS and JSON parsing middleware, then authMiddleware (if the route is protected), then authorizeRoles (if role restriction applies), then program-tier scoping middleware where applicable, and finally the controller handler. The handler queries or mutates Mongoose documents and returns JSON responses with appropriate HTTP status codes (200, 201, 400, 401, 403, 404, 500)."
    ),
    body("Table 4.7: Backend technology stack.", { bold: true }),
    simpleTable(
      ["Component", "Technology", "Version (package.json)"],
      [
        ["Runtime", "Node.js", "18+"],
        ["Framework", "Express", "5.x"],
        ["Database", "MongoDB", "Local / Atlas"],
        ["ODM", "Mongoose", "9.x"],
        ["Authentication", "JWT (jsonwebtoken)", "9.x"],
        ["Password hashing", "bcryptjs", "3.x"],
        ["File uploads", "Multer", "2.x"],
      ],
      [2500, 3500, 3000]
    ),
    spacer(),
    ...figureBlock("fig-4-15-backend-architecture.png", "Figure 4.15: Backend three-tier architecture diagram (React → Express → MongoDB).")
  );

  // ── 4.3.2 API ──
  children.push(
    heading("4.3.2 API Development", HeadingLevel.HEADING_2),
    body(
      "The system implements a RESTful API consumed exclusively by the React web client. All endpoints are prefixed with /api. HTTP methods follow REST conventions: GET for retrieval, POST for creation, PATCH/PUT for updates, and DELETE for removal. Request bodies are JSON; file uploads use multipart/form-data through Multer."
    ),
    body(
      "Authentication on API requests requires the Authorization: Bearer <JWT> header. Shared staff accounts additionally send X-Program-Tier: ug or X-Program-Tier: pg to scope data to the selected portal. Error responses return JSON objects with a message field and appropriate HTTP status codes."
    ),
    body("Table 4.8: Representative REST API endpoints.", { bold: true }),
    simpleTable(
      ["Method", "Endpoint", "Role(s)", "Purpose"],
      [
        ["POST", "/api/auth/login", "Public", "Authenticate and receive JWT"],
        ["GET", "/api/users", "Director", "List institutional users"],
        ["POST", "/api/users", "Director", "Create user account"],
        ["GET", "/api/proposals", "Staff, Researcher", "List proposals (scoped)"],
        ["POST", "/api/proposals", "Researcher", "Create proposal"],
        ["POST", "/api/proposals/:id/submit", "Researcher", "Submit proposal"],
        ["POST", "/api/proposals/:id/assign-committee", "Director", "Assign committee reviewer"],
        ["POST", "/api/proposals/:id/assign-finance", "Director", "Assign finance reviewer"],
        ["PATCH", "/api/proposals/:id/approve", "Director", "Final approve (ready_for_director)"],
        ["GET", "/api/proposals/my-review-assignments", "Leadership, Coordinator, Finance", "Reviewer queue"],
        ["GET", "/api/funding-calls", "Director, Researcher", "List funding calls"],
        ["POST", "/api/funding-calls", "Director", "Create funding call"],
        ["GET", "/api/grants", "Staff, Researcher", "List grant applications"],
        ["GET", "/api/projects", "All authenticated", "List projects"],
        ["GET", "/api/budgets", "Director, Finance", "Budget records"],
        ["GET", "/api/ethics", "Staff, Researcher", "Ethics applications"],
        ["GET", "/api/thesis-groups", "Coordinator, Researcher", "Thesis groups"],
        ["POST", "/api/thesis-groups/:id/final-document", "Researcher (supervisor)", "Upload final thesis"],
        ["GET", "/api/analytics/dashboard", "All authenticated", "Dashboard metrics"],
        ["GET", "/api/notifications", "All authenticated", "User notifications"],
        ["GET", "/api/search", "All authenticated", "Cross-module search"],
      ],
      [900, 2800, 2200, 3100]
    ),
    spacer()
  );

  // ── 4.3.3 Testing ──
  children.push(
    heading("4.3.3 Testing", HeadingLevel.HEADING_2),
    body(
      "Backend and API testing combined manual verification with automated smoke scripts. No Postman collection is included in the repository; API requests were tested through the React client network layer and through Node.js scripts executed against a running local server."
    ),
    body(
      "Functional testing. Controller handlers were verified by exercising complete workflows through the UI and confirming correct document state in MongoDB using Compass or script queries."
    ),
    body(
      "API testing. The verifyAllStakeholders.js script authenticates each seed user (Research Director, Faculty Coordinator, Finance Officer, Leadership, Researcher) and calls role-specific GET endpoints, asserting HTTP 200 responses. Cross-tier staff accounts are tested with both ug and pg program tier headers."
    ),
    body("Table 4.9: API smoke test results (verifyAllStakeholders.js).", { bold: true }),
    simpleTable(
      ["Role", "Endpoint tested", "Expected", "Actual", "Status"],
      [
        ["research_director", "GET /api/analytics/dashboard", "200", "200", "Pass"],
        ["research_director", "GET /api/proposals", "200", "200", "Pass"],
        ["research_director", "GET /api/funding-calls", "200", "200", "Pass"],
        ["faculty_coordinator", "GET /api/ethics", "200", "200", "Pass"],
        ["finance_officer", "GET /api/budgets", "200", "200", "Pass"],
        ["finance_officer", "GET /api/analytics/finance-report", "200", "200", "Pass"],
        ["leadership", "GET /api/proposals/my-review-assignments", "200", "200", "Pass"],
        ["leadership", "GET /api/analytics/kpi-dashboard", "200", "200", "Pass"],
        ["researcher", "GET /api/projects", "200", "200", "Pass"],
        ["researcher", "GET /api/funding-calls", "200", "200", "Pass"],
      ],
      [1800, 2800, 1200, 1200, 800]
    ),
    spacer(),
    body(
      "Database testing. Mongoose schema validation was verified by attempting invalid inserts (missing required fields, invalid enum values) and confirming server-side rejection with 400 responses. Referential integrity between proposals, projects, grants, and budgets was confirmed after approval workflows."
    ),
    body(
      "Validation testing. Required field validation, email format checks, password minimum length, and file type restrictions were tested on both client and server. Server-side validation remains authoritative; client checks provide immediate user feedback."
    ),
    body(
      "Error handling. Invalid ObjectId parameters return 404. Unauthenticated requests return 401. Role violations return 403. Malformed JSON bodies return 400. These behaviours were confirmed through manual API calls with invalid tokens, wrong roles, and malformed payloads."
    ),
    body(
      "Performance testing. No formal load testing tool (e.g., Apache JMeter) was used. Informal testing with institutional seed data (multiple proposals, projects, and thesis groups) confirmed that list and filter endpoints respond within acceptable time on local hardware. Formal performance benchmarking is recommended for production deployment."
    )
  );

  // ── 4.4 Security ──
  children.push(
    heading("4.4 Security Implementation and Testing"),
    heading("4.4.1 Authentication and Authorization", HeadingLevel.HEADING_2),
    body(
      "Authentication is implemented through email and password login. Passwords are hashed using bcryptjs before storage in the User collection; plain-text passwords are never persisted. Upon successful login, the server issues a JWT access token signed with a secret key configured in environment variables (JWT_SECRET). The token payload includes the user identifier and role."
    ),
    body(
      "Authorization is enforced through role-based access control (RBAC). The authorizeRoles Express middleware accepts an array of permitted roles and returns HTTP 403 Forbidden if the authenticated user's role is not included. Sensitive routes—including user creation, funding call management, proposal assignment, final approval, and repository upload—are protected with role checks on both backend routes and frontend ProtectedRoute components."
    ),
    body(
      "Program-tier isolation adds a second dimension to authorisation. Shared staff accounts (Director, Coordinator, Finance, Leadership) operate within the portal selected at login. The programTierScope middleware and X-Program-Tier header ensure database queries filter by ug or pg tier, preventing cross-portal data leakage."
    ),
    body(
      "Account lifecycle control restricts user creation to the Research Director. Researchers cannot self-register. Inactive accounts are blocked at login. Session expiration follows JWT expiry configuration; expired tokens are rejected by authMiddleware."
    ),
    heading("4.4.2 Input Validation", HeadingLevel.HEADING_2),
    body(
      "Client-side validation is implemented in React form components using required attributes, conditional rendering of error messages, and pre-submit checks (e.g., minimum four thesis students, required proposal fields). This reduces unnecessary API calls and provides immediate feedback."
    ),
    body(
      "Server-side validation is authoritative. Mongoose schemas define required fields, type constraints, and enum values for statuses and roles. Controller handlers perform additional business-rule checks (e.g., assertStagesBeforeDirector before final approval, committee must pass before finance review). File uploads through Multer restrict allowed MIME types to PDF, DOC, and DOCX with configurable size limits."
    ),
    body(
      "MongoDB driver parameterisation through Mongoose query methods provides protection against SQL injection (not applicable to MongoDB) and NoSQL injection when user input is passed as typed query parameters rather than raw query objects. Express json body parser limits payload size. No dedicated XSS sanitisation library is installed; React's default JSX escaping mitigates stored XSS in rendered content."
    ),
    heading("4.4.3 Security Testing Methods", HeadingLevel.HEADING_2),
    body(
      "Security testing was performed through manual testing and code review. No automated penetration testing tools (OWASP ZAP, Burp Suite) were used during this FYP timeframe."
    ),
    body("Table 4.10: Security test summary.", { bold: true }),
    simpleTable(
      ["Test activity", "Method", "Result", "Fix applied"],
      [
        ["Unauthenticated API access", "Manual: call /api/proposals without token", "401 Unauthorized", "N/A — working as designed"],
        ["Wrong role access", "Manual: researcher calls POST /api/users", "403 Forbidden", "N/A — RBAC enforced"],
        ["Cross-tier data access", "Manual: UG token queries PG records", "Empty result / 403", "N/A — tier scoping enforced"],
        ["Invalid JWT", "Manual: tampered Bearer token", "401 Unauthorized", "N/A — signature verification"],
        ["Disallowed file type", "Manual: upload .exe to repository", "400 rejection", "N/A — Multer filter"],
        ["Premature director approval", "Manual: approve before stages complete", "400 / UI locked", "assertStagesBeforeDirector added"],
        ["Finance before committee", "Manual: finance review on pending committee", "Blocked in controller and UI", "Assign-first gates added"],
      ],
      [2200, 1800, 2200, 2800]
    ),
    spacer(),
    body(
      "Issues found during security testing included the ability to approve proposals before multi-stage review completed and finance officers accessing reviews before committee approval. Both issues were corrected by adding server-side pipeline assertions (assertStagesBeforeDirector, committee-pass gate in proposalReviewController) and corresponding frontend visibility locks. The final security posture meets basic standards appropriate for an institutional intranet-style web application. Formal penetration testing and HTTPS hardening are recommended before production deployment on a public network."
    )
  );

  // Closing
  children.push(
    body(
      "In summary, Chapter IV has presented the implemented web application, detailed the complete workflows of the three core business modules (Voluntary Proposal Management, Funding Call Management, and Thesis Management), documented black-box and API testing results, and described the security controls applied. The evidence confirms that the MERN-based Research Management System operates correctly for all five institutional roles and satisfies the functional requirements defined for this Final Year Project."
    ),
    new Paragraph({
      spacing: { before: 400, after: 200, line: LINE },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "End of Chapter IV",
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
  fs.writeFileSync(OUT_PRIMARY, buffer);
  console.log("Wrote:", OUT_PRIMARY);

  try {
    fs.writeFileSync(OUT_COPY, buffer);
    console.log("Copy:", OUT_COPY);
  } catch (err) {
    const alt = path.join(DOCS, "CHAPTER_IV_IMPLEMENTATION_AND_RESULTS_NEW.docx");
    fs.writeFileSync(alt, buffer);
    console.log("Copy locked; wrote:", alt, "(", err.code, ")");
  }

  console.log("Size KB:", Math.round(buffer.length / 1024));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Build Thesis Defense Q&A preparation document (Word).
 * Run: node docs/FYP_Defense_QA/build-defense-qa-docx.js
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
  Header,
  Footer,
  PageNumber,
  convertInchesToTwip,
} = require("docx");

const OUT_DIR = __dirname;
const DOCS = path.resolve(__dirname, "..");
const OUT = path.join(OUT_DIR, "Thesis_Defense_QA_Preparation.docx");
const OUT_COPY = path.join(DOCS, "THESIS_DEFENSE_QA_PREPARATION.docx");

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

function qa(num, question, answer, somaliHint) {
  return [
    new Paragraph({
      spacing: { before: 280, after: 120, line: LINE },
      children: [
        new TextRun({ text: `Q${num}. `, font: FONT, size: SIZE, bold: true }),
        new TextRun({ text: question, font: FONT, size: SIZE, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80, line: LINE },
      indent: { left: convertInchesToTwip(0.25) },
      children: [
        new TextRun({ text: "Answer: ", font: FONT, size: SIZE, bold: true, italics: true }),
        new TextRun({ text: answer, font: FONT, size: SIZE }),
      ],
    }),
    somaliHint
      ? new Paragraph({
          spacing: { after: 160, line: LINE },
          indent: { left: convertInchesToTwip(0.25) },
          children: [
            new TextRun({
              text: `Jawaab kooban (So): ${somaliHint}`,
              font: FONT,
              size: 22,
              italics: true,
              color: "444444",
            }),
          ],
        })
      : new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

const SECTIONS = [
  {
    title: "Section A — General and Project Overview",
    items: [
      {
        q: "What is your project about?",
        a: "My project is the design and implementation of a web-based Research Management System (JUST RMS) for Jamhuriya University of Science and Technology. It digitises the full research lifecycle: voluntary proposals, funding-call grant applications, ethics clearance (JUREC), multi-stage review, project creation, finance and budgeting, thesis group supervision, publications, and institutional reporting—all in one MERN-stack web portal with role-based access for five institutional roles.",
        so: "Mashruucaygu waa nidaam web ah oo maamula cilmi-baarista jaamacadda: proposal, ethics, review, project, finance, thesis, publications—hal portal.",
      },
      {
        q: "What problem does your system solve?",
        a: "Before this system, research administration at the university relied on paper forms, email attachments, and spreadsheets. This caused slow approvals, lost documents, unclear financial tracking, and weak institutional reporting. JUST RMS replaces that fragmented practice with a single authenticated portal where each role completes its duty in a traceable digital workflow.",
        so: "Dhibaatada: warqado, email, Excel. Xalku: hal nidaam digital ah oo cad oo la raaci karo.",
      },
      {
        q: "Why did you choose a web application and not a mobile app?",
        a: "The university specification and project scope required a web-based system accessible from any browser on desktop, tablet, or phone. I implemented a responsive React interface that adapts to smaller screens. A native mobile application was explicitly out of scope and is listed as future work in Chapter Five.",
        so: "Shuruudda jaamacaddu waxay ahayd web. Mobile waa mustaqbal; hadda responsive web ayaa jira.",
      },
      {
        q: "What are the six research objectives and were they achieved?",
        a: "The six objectives are: (1) digitise proposal submission and review workflow; (2) automate project creation after Director approval; (3) manage grants, budgets, payments, and purchase orders; (4) track publications and repository assets; (5) provide role-based dashboards and PDF reports; (6) support Undergraduate and Postgraduate portals. All six were fully achieved, with additional delivery of ethics (JUREC), thesis supervision, and in-app notifications.",
        so: "Lix ujeeddo—dhammaantood waa la gaadhay; dheeraad ahaan ethics iyo thesis.",
      },
    ],
  },
  {
    title: "Section B — Technology and Architecture",
    items: [
      {
        q: "What technology stack did you use and why?",
        a: "I used the MERN stack: MongoDB for flexible document storage of research records; Express 5 and Node.js for the REST API; React 19 with Vite for the frontend; JWT and bcrypt for authentication. MERN is widely used, well documented, and suitable for a student-maintainable institutional web application with rapid iteration.",
        so: "MERN: MongoDB, Express, React, Node. Waa stack caan ah oo ku habboon web app.",
      },
      {
        q: "Explain your system architecture.",
        a: "The system follows a three-tier architecture. The browser client (React + Vite) sends HTTP requests to the Express REST API. Middleware handles JWT authentication, role authorisation (authorizeRoles), and program-tier scoping (X-Program-Tier header). Controllers implement business logic; Mongoose models persist data in MongoDB. Uploaded files are stored on the server under /uploads.",
        so: "Saddex heer: React → Express API → MongoDB. Middleware: JWT, roles, UG/PG.",
      },
      {
        q: "How many database collections (models) does your system have?",
        a: "The system has 18 MongoDB collections implemented as Mongoose models, including User, Proposal, Project, EthicsApplication, FundingCall, Grant, Budget, PurchaseOrder, Payment, Publication, RepositoryItem, ThesisGroup, ResearchGroup, Notification, Department, InstitutionalPolicy, Conversation, and AuditEvent.",
        so: "18 collection: User, Proposal, Project, Grant, Budget, Thesis, iwm.",
      },
      {
        q: "What is the difference between voluntary proposals and grant fund call proposals?",
        a: "A voluntary proposal is an unfunded research idea submitted without applying to a funding call. After peer and committee review, the Director approves and a voluntary Project is created; finance review is skipped. A grant fund call proposal is linked to a published FundingCall via callId. It follows the same peer and committee stages but additionally requires finance review before the Director can approve. Approval creates a Grant, a funded Project, and a Budget.",
        so: "Voluntary: ma aha grant, finance la dhaafay. Grant: funding call, finance waa loo baahan yahay.",
      },
    ],
  },
  {
    title: "Section C — User Roles and Security",
    items: [
      {
        q: "How many user roles exist and what can each role do?",
        a: "Five active roles: (1) Research Director—creates users, manages funding calls, assigns reviewers, approves proposals and ethics, oversees the system; (2) Faculty Coordinator—committee review, thesis title accept/reject; (3) Finance Officer—finance review for grant proposals, budgets, payments, grant approvals; (4) University Leadership—peer review scoring (1–5); (5) Researcher—creates proposals, applies to funding calls, manages projects, supervises thesis groups, uploads publications.",
        so: "5 role: Director, Coordinator, Finance, Leadership, Researcher—mid walba shaqo gaar ah.",
      },
      {
        q: "How does authentication work?",
        a: "Users log in with email and password. The server compares the password against a bcrypt hash stored in the User collection. On success, the API returns a JWT access token (and refresh token in an HTTP-only cookie). Every protected API request sends Authorization: Bearer <token>. The authMiddleware verifies the token and attaches the user to the request.",
        so: "Login → bcrypt → JWT token → Bearer header mar kasta.",
      },
      {
        q: "How do you prevent unauthorised access?",
        a: "Role-based access control is enforced on both backend and frontend. Backend routes use authorizeRoles middleware—unauthorised roles receive HTTP 403. The React ProtectedRoute component mirrors these rules. Researchers cannot access Director-only pages such as user management or funding-call creation.",
        so: "RBAC backend iyo frontend—403 haddii role-ka aanu xaq u lahayn.",
      },
      {
        q: "How are Undergraduate and Postgraduate data kept separate?",
        a: "Shared staff (Director, Coordinator, Finance, Leadership) select UG or PG portal after login. The choice is stored in session storage and sent as the X-Program-Tier header on every API request. Program-tier middleware scopes database queries so UG researchers and records do not appear in the PG portal and vice versa.",
        so: "X-Program-Tier header—UG iyo PG xogtu way kala go'daan.",
      },
      {
        q: "How are passwords stored?",
        a: "Passwords are never stored in plain text. They are hashed using bcryptjs before being saved in MongoDB. Login compares the submitted password against the hash using bcrypt.compare.",
        so: "Password bcrypt hash—ma keydin plain text.",
      },
    ],
  },
  {
    title: "Section D — Core Workflows (Voluntary Proposal, Funding Call, Thesis)",
    items: [
      {
        q: "Walk us through the voluntary proposal workflow from start to finish.",
        a: "The researcher creates a draft proposal with title, abstract, department, and embedded ethics application, then submits. The Director assigns Leadership peer reviewers from the multi-stage review page. Each reviewer submits a score (1–5) and comment. When all peer reviews complete, the Director assigns a Faculty Coordinator for committee review. After committee passes, the pipeline reaches ready_for_director and the Proposal decision unlocks. The Director approves, and the system automatically creates a linked Project. Finance is not required for voluntary proposals.",
        so: "Researcher submit → peer → committee → Director approve → Project auto.",
      },
      {
        q: "Why is the Director final decision locked until multi-stage review completes?",
        a: "During testing I found that premature approval was possible before all review stages finished. I fixed this by adding assertStagesBeforeDirector on the backend and hiding the Proposal decision section on the frontend until currentReviewStage equals ready_for_director. This ensures peer and committee (and finance for grants) must pass before final approval.",
        so: "Si Director uusan u ansixin ka hor inta review-ku dhammaan—backend iyo UI waa la xidhay.",
      },
      {
        q: "Explain the funding call and grant application workflow.",
        a: "The Director creates and publishes a FundingCall (internal or external). Researchers see open calls and apply via /grants/apply?callId=..., which creates a grant_fund_call proposal. The same multi-stage review applies: peer, committee, then finance (Finance Officer reviews at /finance/reviews). After all stages pass, the Director approves. The backend creates a Grant (pending_finance), a funded Project, and a Budget for finance processing.",
        so: "Director publish call → researcher apply → peer → committee → finance → approve → Grant + Project + Budget.",
      },
      {
        q: "Why must committee review pass before finance review?",
        a: "Finance review for grant proposals is blocked until committeeReview status is passed. This is enforced in proposalReviewController on the backend and in FinanceProposalReviewsPage on the frontend. It reflects institutional order: academic committee must endorse the proposal before finance evaluates the budget.",
        so: "Committee waa inuu pass noqdaa ka hor finance—backend iyo UI labadaba.",
      },
      {
        q: "Explain the thesis management module.",
        a: "The supervisor creates a thesis group with at least four students, faculty, department, and meeting schedule. The supervisor later enters the student-chosen thesis title and submits it for approval. The Faculty Coordinator accepts or rejects the title. Once accepted, chapter progress can be tracked, supervision meetings logged, and the supervisor uploads the final thesis as PDF or Word. Staff can download the final document.",
        so: "Min 4 arday → supervisor title → coordinator accept → chapters → meetings → final upload.",
      },
      {
        q: "What is ethics (JUREC) and how does it relate to proposals?",
        a: "Ethics clearance is required for research involving human subjects. The researcher completes an ethics application embedded in the proposal form. The Research Director reviews and approves ethics separately from the committee review, and a JUREC certificate PDF can be downloaded after approval. Director cannot approve the proposal to create a project until ethics is cleared when requiresEthics is true.",
        so: "Ethics waa JUREC—Director ansixiyaa, certificate PDF la soo dejisan karaa.",
      },
    ],
  },
  {
    title: "Section E — Testing, Limitations, and Future Work",
    items: [
      {
        q: "How did you test the system?",
        a: "I used manual black-box testing through the browser with seeded demo accounts for all five roles. I documented test cases in Chapter Four (authentication, voluntary workflow, grant workflow, thesis, tier isolation, file upload). I also ran verifyAllStakeholders.js, a backend script that logs in each seed user and checks role-specific API endpoints return HTTP 200. No automated Jest or Vitest unit tests exist—the package.json test script reports no tests yet.",
        so: "Manual black-box + verifyAllStakeholders script—ma jiraan unit tests.",
      },
      {
        q: "What are the main limitations of your project?",
        a: "Key limitations: no native mobile app (responsive web only); notifications are primarily in-app (email depends on SMTP configuration); no formal penetration testing or load testing; no automated unit/integration test suite; single-institution scope (Jamhuriya UG/PG only); production SSL and backups depend on university IT after handover; no integration with student information systems or Turnitin.",
        so: "Mobile ma jiro, testing manual, load test ma jirin, hal jaamacad, SMTP email optional.",
      },
      {
        q: "What would you improve in a future version?",
        a: "Recommendations include: Progressive Web App or native mobile; reliable email notification delivery with production SMTP; Jest/Vitest automated tests; OWASP security audit with helmet and rate limiting; institutional HTTPS hosting with backups; Turnitin integration for thesis; expanded analytics for accreditation reporting; pagination and caching for scalability.",
        so: "PWA/mobile, email, automated tests, security audit, HTTPS, Turnitin, analytics.",
      },
      {
        q: "Did you use OWASP ZAP or Burp Suite for security testing?",
        a: "No. Security was verified through manual testing and code review—unauthorised role access returns 403, invalid JWT returns 401, tier isolation blocks cross-portal data. Formal penetration testing with OWASP ZAP or Burp Suite was not completed within the FYP timeframe and is recommended for production deployment.",
        so: "Maya—manual testing kaliya; pentest waa mustaqbal.",
      },
    ],
  },
  {
    title: "Section F — Demo and Practical Panel Questions",
    items: [
      {
        q: "Can you demonstrate login and portal selection?",
        a: "Yes. I open http://localhost:5173/login, sign in as director@rms.edu, select Undergraduate portal, and land on the dashboard with live module counts (Ethics, Proposals, Projects, Grants, Thesis, etc.).",
        so: "Login director → portal UG → dashboard counts.",
      },
      {
        q: "Show us how a researcher submits a voluntary proposal.",
        a: "Log in as asha@rms.edu (UG researcher), go to Proposals → New voluntary proposal, fill title, abstract, department, ethics section, save draft or submit. The proposal appears in the staff queue with status submitted.",
        so: "Researcher → Proposals/new → fill form → submit.",
      },
      {
        q: "Show us the multi-stage review and assign peer reviewers.",
        a: "As Director, open Proposals → Review on a submitted proposal. The multi-stage review panel shows peer, committee, and finance stages. I assign Leadership reviewers, they submit scores from their review-assignments queue, then I assign committee and eventually unlock final approval when ready_for_director.",
        so: "Director → Review → Assign peer → Leadership score → committee → approve.",
      },
      {
        q: "What happens when the Director approves a proposal?",
        a: "The proposal status becomes approved. The backend creates a Project document linked to the proposal via proposalId. The project appears in the Projects module with PI name, status, and progress. For grant proposals, a Grant and Budget are also created.",
        so: "Approve → Project auto-create; grant → Grant + Budget sidoo kale.",
      },
      {
        q: "How do you deploy the system?",
        a: "The repository includes render.yaml for Render.com deployment with MongoDB Atlas. The backend serves the built React frontend and API from one Node process. Environment variables configure MONGO_URI, JWT_SECRET, and CLIENT_ORIGIN. For production, university IT should provide institutional hosting, SSL, and backup policies.",
        so: "Render + MongoDB Atlas; production IT waa inay SSL iyo backup bixiyaan.",
      },
      {
        q: "Who can create new user accounts?",
        a: "Only the Research Director can create, edit, and delete user accounts through the Users page (/pending-users). Self-registration is not open; the login page states that users must contact the Director for account creation.",
        so: "Kaliya Director—/Users page.",
      },
      {
        q: "What is the minimum number of students in a thesis group and why?",
        a: "The minimum is four students, enforced on both client (MIN_THESIS_GROUP_STUDENTS = 4 in ThesisGroups.jsx) and server. This reflects institutional practice for undergraduate thesis groups at the faculty.",
        so: "Ugu yaraan 4 arday—client iyo server labadaba.",
      },
      {
        q: "If the panel asks something you do not know, how should you respond?",
        a: "Acknowledge the question honestly. If it is outside implemented scope, say it is listed as future work or was not part of the FYP requirements. If it is a technical detail you are unsure about, offer to show the relevant code file or API route in the repository rather than guessing.",
        so: "Si daacad ah u sheeg; haddii aan la implement-garin, future work; code tus haddii loo baahdo.",
      },
    ],
  },
];

async function main() {
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120, line: LINE },
      children: [
        new TextRun({
          text: "THESIS DEFENSE — QUESTIONS AND ANSWERS",
          font: FONT,
          size: 32,
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80, line: LINE },
      children: [
        new TextRun({
          text: "Jamhuriya Research Management System (JUST RMS)",
          font: FONT,
          size: 26,
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400, line: LINE },
      children: [
        new TextRun({
          text: "Preparation guide for oral defense / viva panel",
          font: FONT,
          size: SIZE,
          italics: true,
        }),
      ],
    }),
    body(
      "This document lists likely questions the thesis defense panel may ask, with prepared answers based on the actual implementation of the web-based Research Management System. Answers reflect the MERN codebase, Chapter Four testing evidence, and Chapter Five discussion. Short Somali hints (Jawaab kooban) are included to help you respond confidently in the viva."
    ),
    body(
      "Tip: Practice answering aloud in 30–60 seconds per question. Be ready to demonstrate login, proposal review, funding call apply, and thesis group screens if the panel requests a live demo."
    )
  );

  let qNum = 1;
  for (const section of SECTIONS) {
    children.push(heading(section.title, HeadingLevel.HEADING_2));
    for (const item of section.items) {
      children.push(...qa(qNum, item.q, item.a, item.so));
      qNum++;
    }
  }

  children.push(
    heading("Quick Reference — Demo Accounts", HeadingLevel.HEADING_2),
    body("Use these accounts during the defense demo (after npm run seed):"),
    body("Research Director: director@rms.edu / Director2024! (select UG or PG portal)"),
    body("Faculty Coordinator: coordinator@rms.edu / Coordinator2024!"),
    body("Finance Officer: finance@rms.edu / Finance2024!"),
    body("Leadership (peer review): leadership@rms.edu / Leadership2024!"),
    body("Researcher UG: asha@rms.edu / Researcher2024!"),
    body("Researcher PG: mahad@rms.edu / Researcher2024!"),
    new Paragraph({
      spacing: { before: 400, after: 200, line: LINE },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Good luck with your thesis defense",
          font: FONT,
          size: SIZE,
          italics: true,
          bold: true,
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
                    text: "JUST RMS — Defense Q&A",
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
  fs.writeFileSync(OUT_COPY, buffer);
  console.log("Wrote:", OUT);
  console.log("Copy:", OUT_COPY);
  console.log("Questions:", qNum - 1);
  console.log("Size KB:", Math.round(buffer.length / 1024));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

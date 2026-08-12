/**
 * Build a clear, audience-friendly PowerPoint that explains every JUST RMS module.
 * Run: node build-modules-pptx.js
 */
const path = require("path");
const fs = require("fs");

async function main() {
  let PptxGenJS;
  try {
    PptxGenJS = require("pptxgenjs");
  } catch {
    console.error("Installing pptxgenjs locally...");
    require("child_process").execSync("npm install pptxgenjs@3 --no-save", {
      cwd: __dirname,
      stdio: "inherit",
    });
    PptxGenJS = require("pptxgenjs");
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  pptx.author = "JUST Research Management System";
  pptx.title = "JUST RMS — Module Guide (Clear Explanations)";
  pptx.subject = "Simple explanations of every module in the Research Management System";

  const BRAND = "1B4F72";
  const ACCENT = "2874A6";
  const SOFT = "EBF5FB";
  const TEXT = "1C2833";
  const MUTED = "5D6D7E";
  const WHITE = "FFFFFF";

  function addChrome(slide, pageLabel) {
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 0.55,
      fill: { color: BRAND },
      line: { color: BRAND },
    });
    slide.addText("Jamhuriya University · Research Management System (JUST RMS)", {
      x: 0.4,
      y: 0.12,
      w: 10,
      h: 0.35,
      fontSize: 12,
      color: WHITE,
      fontFace: "Calibri",
    });
    if (pageLabel) {
      slide.addText(pageLabel, {
        x: 10.5,
        y: 0.12,
        w: 2.5,
        h: 0.35,
        fontSize: 11,
        color: WHITE,
        align: "right",
        fontFace: "Calibri",
      });
    }
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0,
      y: 7.15,
      w: 13.333,
      h: 0.35,
      fill: { color: SOFT },
      line: { color: SOFT },
    });
    slide.addText("Simple guide — anyone can understand what each module does", {
      x: 0.4,
      y: 7.2,
      w: 12.5,
      h: 0.25,
      fontSize: 10,
      color: MUTED,
      fontFace: "Calibri",
    });
  }

  function titleSlide(title, subtitle) {
    const slide = pptx.addSlide();
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5,
      fill: { color: BRAND },
    });
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0,
      y: 5.8,
      w: 13.333,
      h: 1.7,
      fill: { color: ACCENT },
    });
    slide.addText(title, {
      x: 0.7,
      y: 2.2,
      w: 12,
      h: 1.2,
      fontSize: 36,
      bold: true,
      color: WHITE,
      fontFace: "Calibri",
    });
    slide.addText(subtitle, {
      x: 0.7,
      y: 3.5,
      w: 11.5,
      h: 1,
      fontSize: 18,
      color: "D4E6F1",
      fontFace: "Calibri",
    });
    slide.addText("Undergraduate (UG) & Postgraduate (PG) · Role-based access · Full research lifecycle", {
      x: 0.7,
      y: 6.2,
      w: 12,
      h: 0.5,
      fontSize: 14,
      color: WHITE,
      fontFace: "Calibri",
    });
  }

  function sectionSlide(number, title, oneLiner) {
    const slide = pptx.addSlide();
    addChrome(slide, `Section ${number}`);
    slide.addText(String(number).padStart(2, "0"), {
      x: 0.7,
      y: 2.2,
      w: 3,
      h: 1,
      fontSize: 48,
      bold: true,
      color: ACCENT,
      fontFace: "Calibri",
    });
    slide.addText(title, {
      x: 0.7,
      y: 3.3,
      w: 11.5,
      h: 0.8,
      fontSize: 32,
      bold: true,
      color: TEXT,
      fontFace: "Calibri",
    });
    slide.addText(oneLiner, {
      x: 0.7,
      y: 4.2,
      w: 11.5,
      h: 0.8,
      fontSize: 18,
      color: MUTED,
      fontFace: "Calibri",
    });
  }

  function moduleSlide({ title, what, who, how, tip }) {
    const slide = pptx.addSlide();
    addChrome(slide, title);
    slide.addText(title, {
      x: 0.5,
      y: 0.75,
      w: 12.3,
      h: 0.5,
      fontSize: 26,
      bold: true,
      color: TEXT,
      fontFace: "Calibri",
    });

    const boxes = [
      { label: "What it is", body: what, x: 0.5, y: 1.4, color: "D6EAF8" },
      { label: "Who uses it", body: who, x: 4.55, y: 1.4, color: "D5F5E3" },
      { label: "How it works (simple)", body: how, x: 8.6, y: 1.4, color: "FCF3CF" },
    ];
    for (const b of boxes) {
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: b.x,
        y: b.y,
        w: 3.85,
        h: 4.0,
        fill: { color: b.color },
        line: { color: b.color },
        rectRadius: 0.1,
      });
      slide.addText(b.label, {
        x: b.x + 0.2,
        y: b.y + 0.2,
        w: 3.45,
        h: 0.4,
        fontSize: 14,
        bold: true,
        color: BRAND,
        fontFace: "Calibri",
      });
      slide.addText(b.body, {
        x: b.x + 0.2,
        y: b.y + 0.7,
        w: 3.45,
        h: 3.1,
        fontSize: 13,
        color: TEXT,
        fontFace: "Calibri",
        valign: "top",
      });
    }

    if (tip) {
      slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
        x: 0.5,
        y: 5.55,
        w: 12.3,
        h: 1.35,
        fill: { color: SOFT },
        line: { color: SOFT },
        rectRadius: 0.08,
      });
      slide.addText("Remember", {
        x: 0.7,
        y: 5.65,
        w: 12,
        h: 0.3,
        fontSize: 12,
        bold: true,
        color: BRAND,
        fontFace: "Calibri",
      });
      slide.addText(tip, {
        x: 0.7,
        y: 5.95,
        w: 12,
        h: 0.75,
        fontSize: 13,
        color: TEXT,
        fontFace: "Calibri",
      });
    }
  }

  function bulletSlide(title, bullets) {
    const slide = pptx.addSlide();
    addChrome(slide, title);
    slide.addText(title, {
      x: 0.5,
      y: 0.8,
      w: 12.3,
      h: 0.55,
      fontSize: 26,
      bold: true,
      color: TEXT,
      fontFace: "Calibri",
    });
    slide.addText(
      bullets.map((t) => ({ text: t, options: { breakLine: true } })),
      {
        x: 0.7,
        y: 1.55,
        w: 12,
        h: 5.2,
        fontSize: 16,
        color: TEXT,
        fontFace: "Calibri",
        paraSpacing: 10,
        bullet: true,
      }
    );
  }

  // —— Slides ——
  titleSlide(
    "JUST Research Management System",
    "A clear guide to every module — what it is, who uses it, and how it works"
  );

  sectionSlide(1, "Big picture", "One system for the full research journey from idea to archive");

  bulletSlide("What problem does the system solve?", [
    "Research used to be scattered: emails, Word files, paper forms, and separate folders.",
    "JUST RMS brings proposal → ethics → review → project → funding → outputs → repository into one place.",
    "Every role sees only what they need (Director, Coordinator, Finance, Leadership, Researcher).",
    "Undergraduate (UG) and Postgraduate (PG) portals stay separate so data does not mix.",
  ]);

  bulletSlide("Research lifecycle (easy map)", [
    "1) Researcher writes a Proposal (voluntary or for a funding call).",
    "2) If needed, Ethics (JUREC) is completed and approved.",
    "3) Proposal is reviewed (peer → committee → finance if grant → Director decision).",
    "4) Approved work becomes a Project (milestones, progress, closure).",
    "5) Funding: Funding Calls → Grant applications → Budgets / payments.",
    "6) Outputs: Publications workflow + Thesis supervision + Repository archive.",
    "7) Oversight: Dashboard, KPI, System Reports, Policies, Notifications.",
  ]);

  bulletSlide("Roles (who does what)", [
    "Research Director — overall decisions, assignments, certificates, institutional view.",
    "Faculty Coordinator — faculty-scoped monitoring, committee work, thesis title decisions.",
    "Finance Officer — grant money approval, budgets, purchase orders, project closures.",
    "Leadership — peer review of proposals assigned by the Director.",
    "Researcher — creates proposals, ethics, projects, grants, publications, thesis work.",
  ]);

  sectionSlide(2, "Core research modules", "From idea and ethics to an approved project");

  moduleSlide({
    title: "Dashboard",
    what: "Your home page after login. Shows counts and shortcuts for the modules you are allowed to open.",
    who: "All roles. Each role sees a different set of tiles (for example Finance sees grant approval and closures).",
    how: "Open Dashboard → read the numbers → click a tile to jump to that module. Staff pick UG or PG portal first.",
    tip: "If a count looks empty for a Coordinator, it may be faculty-scoped (only your faculty, not the whole university).",
  });

  moduleSlide({
    title: "Proposals",
    what: "The formal research idea: title, abstract, department, and whether it needs ethics or funding.",
    who: "Researchers create. Director, Coordinator, and Leadership review. Finance joins only for grant-call proposals.",
    how: "Draft → Submit → multi-stage review → Approve / Revise / Reject. Approval can create a Project.",
    tip: "Two kinds: Voluntary (no finance stage) and Grant fund call (must pass finance after committee).",
  });

  moduleSlide({
    title: "Proposal Review & Peer Reviews",
    what: "Structured checking of a submitted proposal so quality and fairness are recorded in the system.",
    who: "Director assigns peer reviewers. Leadership does peer review. Coordinator handles committee. Director decides.",
    how: "Assign peer → peer scores/comments → assign committee → committee decision → (grant) finance → Director approve.",
    tip: "Peer Reviews page is the Leadership queue. The final Approve button stays locked until required stages are done.",
  });

  moduleSlide({
    title: "Ethics (JUREC)",
    what: "Ethics application for research involving people, animals, or sensitive data. Can issue an official certificate.",
    who: "Researcher fills and submits. Director reviews and can issue a signed JUREC certificate PDF.",
    how: "Create ethics form → Submit → Director decision → if approved, download certificate from Ethics or Notifications.",
    tip: "Ethics is separate from faculty committee. A proposal can require ethics before final project approval.",
  });

  moduleSlide({
    title: "Projects",
    what: "The live research work after a proposal is approved — progress, team, reports, and closure.",
    who: "Researcher owns the project. Director and Coordinator monitor. Finance sees closures for money wrap-up.",
    how: "Open project → track status and milestones → upload progress → request closure when work is finished.",
    tip: "Publications and many grants are linked to a Project so outputs stay connected to the research work.",
  });

  moduleSlide({
    title: "Research Workflow / Journey",
    what: "A story view of one researcher or project: where they are in the lifecycle and what is next.",
    who: "Director and Coordinator (faculty-scoped). Researchers see their own journey.",
    how: "Open Workflow → pick a researcher (or view your own) → follow steps from proposal to outputs.",
    tip: "Use this when someone asks “Where is my research stuck?” — it shows the current stage clearly.",
  });

  sectionSlide(3, "Funding & finance modules", "Calls, grants, budgets, and money control");

  moduleSlide({
    title: "Funding Calls",
    what: "Published opportunities to apply for money (internal or external donor calls) with deadlines and rules.",
    who: "Director publishes/manages. Researchers apply. Coordinator and Finance can view relevant queues.",
    how: "Open call → read eligibility → apply with a linked proposal/grant application before the deadline.",
    tip: "Accepted funding-call proposals remain visible on this page so you can track what was funded.",
  });

  moduleSlide({
    title: "Grants",
    what: "A funding application linked to a call/project: requested amount, status, and award outcome.",
    who: "Researchers apply. Finance approves money. Director/Coordinator monitor faculty or institution view.",
    how: "Create/apply → pending finance → Finance decision → if awarded, budget can be prepared for spending.",
    tip: "Grant approval is a Finance job. Researchers should watch Notifications for approve/reject updates.",
  });

  moduleSlide({
    title: "Budgets, Payments & Purchase Orders",
    what: "How awarded money is planned (budget lines), spent (payments), and procured (purchase orders).",
    who: "Finance leads. Director oversees. Researchers see their own budgets where allowed.",
    how: "Budget created from grant/project → items approved → payments/POs recorded → balances update.",
    tip: "This is the money trail. If a payment fails, check budget remaining and Finance queues first.",
  });

  moduleSlide({
    title: "Finance Closures & Finance Reports",
    what: "Closing a finished project’s money side, plus reports for institutional finance oversight.",
    who: "Finance Officer mainly. Director can view finance reports and donor-facing summaries.",
    how: "Project reaches finance closure queue → Finance confirms → archived. Reports export for review.",
    tip: "Academic closure and finance closure are related but not the same click — Finance owns the money close.",
  });

  sectionSlide(4, "Outputs, thesis & knowledge", "Publishing, supervision, and archive");

  moduleSlide({
    title: "Publications & Faculty Workflow",
    what: "Research outputs (papers, conferences, patents, community impact) linked to a project.",
    who: "Researchers submit. Coordinator/Director advance stages. Journal accept publishes only from Pipeline.",
    how: "Submit output → faculty stages: Submitted → In process → Pipeline → Journal accept → Published.",
    tip: "Faculty “Accept” review is not the same as journal publish. Publish needs Pipeline first, then journal accept.",
  });

  moduleSlide({
    title: "Thesis",
    what: "Undergraduate/postgraduate thesis groups: students, supervisor, title approval, chapters, meetings, final file.",
    who: "Director/Coordinator create groups and decide titles. Researcher supervisors log meetings and chapter progress.",
    how: "Create group → propose title → accept/reject → meetings & chapters → upload final thesis document.",
    tip: "Meetings/chapters stay locked until the thesis title is accepted. Coordinators only manage their faculty groups.",
  });

  moduleSlide({
    title: "Groups (Collaboration)",
    what: "Research collaboration groups for teaming people around shared work (separate from thesis groups).",
    who: "Researchers and staff who collaborate. Director/Coordinator can oversee.",
    how: "Create or join a group → manage members → use it as a collaboration space linked to research activity.",
    tip: "Use Groups for teamwork; use Thesis for formal student supervision and title control.",
  });

  moduleSlide({
    title: "Repository",
    what: "Institutional archive for approved documents and research files that should be kept and shared safely.",
    who: "Staff and researchers with upload/download rights based on role. Director/Coordinator oversee.",
    how: "Upload file with metadata → search/filter → download or export PDF/CSV lists when needed.",
    tip: "Repository is the long-term memory of the system — finished work should land here, not only in email.",
  });

  sectionSlide(5, "Governance & support modules", "Policies, alerts, search, and reporting");

  moduleSlide({
    title: "Policies",
    what: "Official institutional rules and guidance documents attached to system modules.",
    who: "All roles can read published policies. Directors manage institutional policy content.",
    how: "Open Policies → pick a module topic → read the guidance that applies to that part of the system.",
    tip: "When users ask “what is the rule?”, Policies is the first place to check before inventing a process.",
  });

  moduleSlide({
    title: "Notifications & Messages",
    what: "Alerts when something needs action (review assigned, title decided, certificate ready) plus messaging.",
    who: "Every user. Finance and some staff roles have limited message scope by design.",
    how: "Bell icon / Notifications page → read details → open link or download attached document.",
    tip: "Certificate downloads and review links often arrive here — open the notification body before asking for help.",
  });

  moduleSlide({
    title: "Global Search",
    what: "One search box to find proposals, projects, grants, ethics, publications, thesis, and more.",
    who: "All logged-in roles (results respect role and faculty/portal scope).",
    how: "Type a title or keyword → open the matching result → jump straight to the record.",
    tip: "Coordinators only see their faculty matches. Directors see broader institutional results.",
  });

  moduleSlide({
    title: "System Reports & KPI",
    what: "Numbers and summaries for leadership: counts by stage, funding totals, approval rates, exports.",
    who: "Director, Coordinator (faculty scope), Finance, Leadership (as allowed).",
    how: "Open Reports/KPI → read scope label → export PDF/CSV when you need evidence for meetings.",
    tip: "Always read the scope (portal vs faculty). Coordinator KPI is faculty-only, not university-wide.",
  });

  moduleSlide({
    title: "Donor Reports, Users, Departments, Audit",
    what: "Extra governance tools: donor-facing summaries, account/department setup, and an audit trail of important actions.",
    who: "Director/Finance for donor & finance oversight. Director for users/departments. Audit for accountability.",
    how: "Use Donor Reports for external reporting. Manage users/departments in admin areas. Check Audit when you need “who did what”.",
    tip: "These modules support trust and compliance — they are not daily researcher tools.",
  });

  sectionSlide(6, "How to explain the system in 60 seconds", "A short closing story for any audience");

  bulletSlide("60-second explanation", [
    "JUST RMS is one digital office for university research.",
    "A researcher submits a proposal, completes ethics if needed, and waits for review.",
    "After approval, the work becomes a project; funding may come through calls and grants.",
    "Outputs (publications/thesis) are tracked, then stored in the repository.",
    "Dashboards, KPI, and reports help leaders see progress without chasing spreadsheets.",
  ]);

  bulletSlide("Demo accounts (for training)", [
    "director@rms.edu / Director2024!",
    "coordinator@rms.edu / Coordinator2024!",
    "finance@rms.edu / Finance2024!",
    "leadership@rms.edu / Leadership2024!",
    "asha@rms.edu / Researcher2024! (Undergraduate)",
    "mahad@rms.edu / Researcher2024! (Postgraduate)",
  ]);

  const outDir = __dirname;
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "JUST_RMS_Modules_Guide.pptx");
  await pptx.writeFile({ fileName: outFile });
  console.log("Wrote", outFile);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

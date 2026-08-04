/**
 * Build Thesis Defense PowerPoint (.pptx) — 8-section structure (Chapter I aligned).
 * Run: node docs/FYP_Defense_Presentation/build-defense-pptx.js
 */
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const DOCS = path.resolve(__dirname, "..");
const OUT = path.join(DOCS, "THESIS_DEFENSE_PRESENTATION.pptx");
const FIGURES_DIR = path.join(DOCS, "fyp-chapter4-figures");

const NAVY = "1E3A5F";
const ACCENT = "0EA5E9";
const GRAY = "64748B";
const WHITE = "FFFFFF";
const LIGHT = "F8FAFC";

function titleSlide(pptx, { title, subtitle, meta, notes }) {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  slide.addText(title, {
    x: 0.6,
    y: 1.6,
    w: 12.1,
    h: 1.2,
    fontSize: 40,
    bold: true,
    color: WHITE,
    align: "center",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6,
      y: 2.9,
      w: 12.1,
      h: 1.4,
      fontSize: 20,
      color: "CBD5E1",
      align: "center",
    });
  }
  if (meta) {
    slide.addText(meta, {
      x: 0.6,
      y: 5.0,
      w: 12.1,
      h: 1.0,
      fontSize: 14,
      color: "94A3B8",
      align: "center",
    });
  }
  if (notes) slide.addNotes(notes);
  return slide;
}

function sectionSlide(pptx, { section, title, bullets, notes, extra }) {
  const slide = pptx.addSlide();
  slide.background = { color: LIGHT };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.55,
    fill: { color: NAVY },
  });
  slide.addText(section, {
    x: 0.5,
    y: 0.08,
    w: 12.3,
    h: 0.4,
    fontSize: 11,
    bold: true,
    color: ACCENT,
  });
  slide.addText(title, {
    x: 0.5,
    y: 0.75,
    w: 12.3,
    h: 0.7,
    fontSize: 28,
    bold: true,
    color: NAVY,
  });
  if (bullets?.length) {
    slide.addText(
      bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
      {
        x: 0.55,
        y: 1.55,
        w: 12.2,
        h: 5.0,
        fontSize: 16,
        color: "334155",
        valign: "top",
        paraSpaceAfter: 8,
      }
    );
  }
  if (extra) {
    slide.addText(extra, {
      x: 0.55,
      y: 6.2,
      w: 12.2,
      h: 0.6,
      fontSize: 12,
      italic: true,
      color: GRAY,
    });
  }
  slide.addText("Jamhuriya RMS — Thesis Defense", {
    x: 0.5,
    y: 7.05,
    w: 6,
    h: 0.3,
    fontSize: 9,
    color: GRAY,
  });
  if (notes) slide.addNotes(notes);
  return slide;
}

function tableSlide(pptx, { section, title, headers, rows, notes }) {
  const slide = pptx.addSlide();
  slide.background = { color: LIGHT };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.55,
    fill: { color: NAVY },
  });
  slide.addText(section, {
    x: 0.5,
    y: 0.08,
    w: 12.3,
    h: 0.4,
    fontSize: 11,
    bold: true,
    color: ACCENT,
  });
  slide.addText(title, {
    x: 0.5,
    y: 0.75,
    w: 12.3,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: NAVY,
  });
  const tableRows = [
    headers.map((h) => ({
      text: h,
      options: { bold: true, fill: { color: NAVY }, color: WHITE, fontSize: 11 },
    })),
    ...rows.map((row) =>
      row.map((cell) => ({
        text: cell,
        options: { fontSize: 10, color: "334155" },
      }))
    ),
  ];
  slide.addTable(tableRows, {
    x: 0.4,
    y: 1.5,
    w: 12.5,
    colW: [1.2, 3.5, 1.0],
    border: { type: "solid", color: "CBD5E1", pt: 0.5 },
    autoPage: false,
  });
  if (notes) slide.addNotes(notes);
  return slide;
}

/** Slide with 3×2 screenshot grid from docs/fyp-chapter4-figures/ */
function screenshotDemoSlide(pptx, { section, title, shots, footer, notes }) {
  const slide = pptx.addSlide();
  slide.background = { color: LIGHT };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.33,
    h: 0.55,
    fill: { color: NAVY },
  });
  slide.addText(section, {
    x: 0.5,
    y: 0.08,
    w: 12.3,
    h: 0.4,
    fontSize: 11,
    bold: true,
    color: ACCENT,
  });
  slide.addText(title, {
    x: 0.5,
    y: 0.62,
    w: 12.3,
    h: 0.55,
    fontSize: 22,
    bold: true,
    color: NAVY,
  });

  const cols = 3;
  const imgW = 3.95;
  const imgH = 2.15;
  const startX = 0.42;
  const gapX = 0.28;
  const startY = 1.22;
  const rowStep = imgH + 0.38;

  shots.forEach((shot, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (imgW + gapX);
    const y = startY + row * rowStep;
    const fullPath = path.join(FIGURES_DIR, shot.file);
    if (!fs.existsSync(fullPath)) {
      console.warn("Missing screenshot:", fullPath);
      slide.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: imgW,
        h: imgH,
        fill: { color: "E2E8F0" },
        line: { color: "94A3B8", width: 0.5 },
      });
      slide.addText("Missing: " + shot.file, {
        x,
        y: y + imgH / 2 - 0.15,
        w: imgW,
        h: 0.3,
        fontSize: 8,
        color: GRAY,
        align: "center",
      });
    } else {
      slide.addImage({
        path: fullPath,
        x,
        y,
        w: imgW,
        h: imgH,
        sizing: { type: "contain", w: imgW, h: imgH },
      });
    }
    slide.addText(shot.label, {
      x,
      y: y + imgH + 0.04,
      w: imgW,
      h: 0.22,
      fontSize: 9,
      bold: true,
      color: NAVY,
      align: "center",
    });
  });

  if (footer) {
    slide.addText(footer, {
      x: 0.42,
      y: 6.88,
      w: 12.5,
      h: 0.45,
      fontSize: 9,
      color: GRAY,
    });
  }
  if (notes) slide.addNotes(notes);
  return slide;
}

async function main() {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Jamhuriya University RMS FYP";
  pptx.title = "Thesis Defense — Research Management System";
  pptx.subject = "THESIS DEFENSE";

  titleSlide(pptx, {
    title: "THESIS DEFENSE",
    subtitle:
      "Design and Implementation of a Web-Based\nResearch Management System for Jamhuriya University",
    meta: "[Your Full Name]  |  [Student ID]\n[Supervisor Name]  |  JUST  |  [Date]",
    notes:
      "Assalaamu caleykum. Magacaygu waa [magacaaga]. Maanta waxaan u soo bandhigi doonaa thesis defense-kayga: Jamhuriya Research Management System.",
  });

  sectionSlide(pptx, {
    section: "1. INTRODUCTION",
    title: "Introduction",
    bullets: [
      "Universities manage research: proposals, ethics, funding, projects, publications, thesis",
      "Digital transformation improves efficiency, transparency, and accountability",
      "Jamhuriya University (JUST) needs an integrated web platform",
      "This project: Jamhuriya Research Management System (JUST RMS)",
      "Full lifecycle: idea → proposal → ethics → review → project → grant → finance → publication → repository",
    ],
    notes: "Hordhac: JUST waxay u baahan tahay nidaam isku xiran oo web ah.",
  });

  sectionSlide(pptx, {
    section: "1. INTRODUCTION",
    title: "System Overview",
    bullets: [
      "Web application (browser-based — mobile app out of scope)",
      "MERN stack: MongoDB, Express 5, React 19, Node.js",
      "RBAC + JWT authentication — five roles + Leadership (peer review)",
      "Dual portal: Undergraduate (UG) and Postgraduate (PG)",
      "GitHub: github.com/Abdisalam114/research-management-systems",
    ],
    notes: "MERN stack, shan role + Leadership, laba portal UG/PG.",
  });

  sectionSlide(pptx, {
    section: "2. PROBLEM STATEMENT",
    title: "Problem Statement",
    bullets: [
      "Paper forms, email attachments, and Excel spreadsheets",
      "No single system from proposal to publication / thesis",
      "Duplicate data entry and lost documents",
      "Slow approval chains: peer → committee → director → finance",
      "Weak financial tracking: grants, budgets, payments disconnected",
      "Poor institutional reporting for leadership and donors",
      "Impact: delays research, reduces transparency, weakens accountability",
    ],
    notes: "Dhibaatada: warqado, email, Excel — xog way lumaan, ansixintu way gaabisataa.",
  });

  sectionSlide(pptx, {
    section: "3. OBJECTIVES",
    title: "Objectives (Chapter I)",
    bullets: [
      "AIM: Design and develop a web-based RMS that improves efficiency and management of research activities at JUST",
      "O1: Identify challenges of current research management methods",
      "O2: Design a centralized database for secure research information storage",
      "O3: Develop a web-based RMS (proposals, tracking, document management)",
      "O4: Implement reporting and communication for researcher–administrator coordination",
      "O5: Evaluate usability and performance of the proposed system",
    ],
    notes: "Shan ujeeddo Chapter One — challenges, database, develop, reporting, evaluation.",
  });

  sectionSlide(pptx, {
    section: "4. RESEARCH QUESTIONS",
    title: "Research Questions",
    bullets: [
      "RQ1: What challenges are associated with current research management methods?",
      "RQ2: How can a centralized database improve storage and management of research data?",
      "RQ3: How can a web-based RMS be designed and developed for the institution?",
      "RQ4: How can reporting and communication features improve coordination?",
      "RQ5: How effective is the system in efficiency, usability, and accessibility?",
      "→ Answered in Chapter V using Chapter IV implementation evidence",
    ],
    notes: "Shan su'aal cilmi baaris — jawaabtooda Chapter Four iyo Five.",
  });

  sectionSlide(pptx, {
    section: "5. RELATED WORK",
    title: "Related Work",
    bullets: [
      "Commercial systems: Pure (Elsevier), Convergence / Symplectic Elements, national CRIS platforms",
      "Literature themes: central repositories reduce duplication; workflow automation speeds approvals",
      "RBAC protects sensitive grant and ethics data",
      "Gap: many regional universities still use manual processes",
      "Few open MERN-stack RMS tailored to JUST workflows (UG/PG + JUREC + thesis)",
    ],
    notes: "Related work: Pure, CRIS. Mashruucan wuxuu buuxiyaa farqiga JUST.",
  });

  sectionSlide(pptx, {
    section: "5. RELATED WORK",
    title: "Contribution of This Study",
    bullets: [
      "Open-source JUST RMS on GitHub",
      "18 MongoDB collections — full research lifecycle",
      "Multi-stage review: peer, committee, finance, director",
      "Extensions: JUREC ethics certificates, thesis supervision, in-app notifications",
      "Automated project creation (proposal approval) and budget creation (grant award)",
    ],
    notes: "Contribution: nidaam furan, 18 collection, workflows automated.",
  });

  sectionSlide(pptx, {
    section: "6. METHODOLOGY",
    title: "Methodology — Agile Development",
    bullets: [
      "Requirements: Chapter I problem, objectives, university module specification",
      "System design: ERD (18 collections), REST API, React UI",
      "Implementation: MERN stack — React 19 + Vite, Express 5, Mongoose 9",
      "Testing: functional, integration smoke (verifyAllStakeholders.js), device compatibility",
      "Deployment: local development + cloud-ready (Render / MongoDB Atlas)",
      "Tools: Git/GitHub, JWT/bcrypt, Multer uploads, PDFKit reports",
    ],
    notes: "Agile: requirements → design → build → test → deploy.",
  });

  sectionSlide(pptx, {
    section: "6. METHODOLOGY",
    title: "Architecture & Security",
    bullets: [
      "Three-tier: Browser (React) ↔ Express REST API ↔ MongoDB",
      "Security: JWT access tokens • bcrypt passwords • RBAC middleware",
      "programTier field isolates Undergraduate vs Postgraduate portal data",
      "Testing (Chapter IV): black-box functional, unit-level rules, integration smoke",
      "Device compatibility: desktop, tablet, mobile viewports",
      "Informal load observation (formal JMeter not completed — limitation)",
    ],
    notes: "Architecture saddex heer. JWT + RBAC. Testing functional + device.",
  });

  sectionSlide(pptx, {
    section: "7. RESULTS AND DISCUSSION",
    title: "System Delivered — Modules",
    bullets: [
      "1. Proposal Management (+ ethics JUREC, multi-stage review)",
      "2. Project Management (auto-created on Director approval)",
      "3. Grant & Funding Calls (internal/external, finance review)",
      "4. Publications & Outputs (workflow pipeline)",
      "5. Budget & Finance (payments, purchase orders)",
      "6. Institutional Repository (+ OAI-PMH export)",
      "7. Collaboration (research groups + messaging)",
      "8. Analytics & Reporting (KPI, finance, donor, PDF)",
      "Extensions: Thesis Supervision • Research Workflow • Notifications",
    ],
    notes: "Siddeed module + extensions. Auto project iyo auto budget.",
  });

  sectionSlide(pptx, {
    section: "7. RESULTS AND DISCUSSION",
    title: "Key Workflows",
    bullets: [
      "Proposal: Submit → Peer → Committee → [Grant] Finance → Director → ★ PROJECT auto-created",
      "Grant: Funding call → Apply → Approvals → ★ BUDGET auto-created → Payments/POs",
      "Publication: Researcher submits → Director + Coordinator notified (full details in notification)",
      "Ethics: REC form → Director issues JUREC certificate → Download from notifications",
      "Thesis: Coordinator creates group (UG/PG) → Supervisor → Title → Chapters → Final document",
    ],
    notes: "Socodka proposal, grant, publication, ethics, thesis.",
  });

  tableSlide(pptx, {
    section: "7. RESULTS AND DISCUSSION",
    title: "Objective Achievement",
    headers: ["Objective", "Evidence", "Status"],
    rows: [
      ["O1 Challenges", "Documented in Ch. I; system addresses manual gaps", "Fully ✓"],
      ["O2 Database", "18 MongoDB collections, JWT/RBAC, ER diagram", "Fully ✓"],
      ["O3 Web RMS", "React UI + Express API + full lifecycle", "Fully ✓"],
      ["O4 Reporting", "Dashboards, PDF, notifications, messaging", "Fully ✓"],
      ["O5 Evaluation", "Manual/device tests; no Jest/JMeter formal suite", "Partial ◐"],
    ],
    notes: "Afartii ugu horreysay fully achieved; objective 5 partially.",
  });

  sectionSlide(pptx, {
    section: "7. RESULTS AND DISCUSSION",
    title: "Recent Improvements (2026)",
    bullets: [
      "Ethics: faculty → department dropdowns",
      "Publish notification: Director + Coordinator receive full output details in-app",
      "Document download in notifications: JUREC certificate + thesis final PDF",
      "Thesis: duplicate email/ID/title blocked; UG/PG fix; supervisor assignment fixed",
      "KPI Dashboard: clickable cards; Finance/Donor total money rows",
      "Repository: fake seed items filtered from catalogue",
    ],
    notes: "Updates cusub GitHub commit 276e25c.",
  });

  screenshotDemoSlide(pptx, {
    section: "7. RESULTS AND DISCUSSION",
    title: "Testing & Demo — System Screenshots",
    shots: [
      { file: "fig-4-1-login.png", label: "Login" },
      { file: "fig-4-3-director-dashboard.png", label: "Director Dashboard" },
      { file: "fig-4-5-proposal-review.png", label: "Proposal Review" },
      { file: "fig-4-7-projects.png", label: "Projects" },
      { file: "fig-4-11-publications.png", label: "Publications" },
      { file: "fig-4-10-thesis.png", label: "Thesis Supervision" },
    ],
    footer:
      "Functional + integration tests verified ✓   |   Demo: director@rms.edu / Director2024!   |   coordinator@rms.edu / Coordinator2024!",
    notes:
      "Screenshots from Chapter IV (docs/fyp-chapter4-figures). Geli live demo haddii internet jiro.",
  });

  sectionSlide(pptx, {
    section: "8. CONCLUSIONS AND RECOMMENDATIONS",
    title: "Conclusions",
    bullets: [
      "Complete web-based RMS successfully developed for JUST using MERN stack",
      "Addresses Chapter I problem: fragmented manual research administration",
      "Objectives 1–4 fully achieved; Objective 5 partially achieved",
      "All five research questions answered with implementation evidence",
      "Automated workflows reduce manual errors and improve transparency",
      "System tested, documented, and ready for institutional pilot",
      "Open source on GitHub for maintenance and extension",
    ],
    notes: "Gabagabo: nidaamka waa la dhisay, pilot diyaar.",
  });

  sectionSlide(pptx, {
    section: "8. CONCLUSIONS AND RECOMMENDATIONS",
    title: "Recommendations",
    bullets: [
      "Add Jest/Vitest automated tests + formal load testing (JMeter) before production",
      "Configure institutional SMTP for email notifications alongside in-app alerts",
      "Professional penetration testing (OWASP) before public deployment",
      "PWA or native mobile app for offline / push notification needs",
      "Integrate with university student registration / finance systems long-term",
      "Train staff per faculty for pilot rollout",
    ],
    notes: "Talooyin: tests, email, security, mobile mustaqbal, training.",
  });

  titleSlide(pptx, {
    title: "THANK YOU",
    subtitle: "Questions & Discussion\n\nGitHub: github.com/Abdisalam114/research-management-systems",
    meta: "Optional demo: Director login → Approve proposal → Notifications → Ethics → Thesis",
    notes: "Mahadsanidiin! Su'aalo? Demo haddii internet jiro.",
  });

  await pptx.writeFile({ fileName: OUT });
  console.log("Written:", OUT);
  console.log("Slides:", pptx.slides.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

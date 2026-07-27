/**
 * Senior Solutions Architecture Word doc for JUST RMS.
 * node src/scripts/generateSolutionsArchitectureDocx.js
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
  BorderStyle,
  HeadingLevel,
} = require("docx");

const DOCS = path.resolve(__dirname, "../../../docs");
const FIGURES = path.join(DOCS, "figures");

function title(main, sub) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: main, bold: true, size: 40, color: "0369A1" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: sub, bold: true, size: 22, color: "64748B" })],
    }),
    new Paragraph({
      border: { bottom: { color: "0369A1", space: 1, style: BorderStyle.SINGLE, size: 18 } },
      spacing: { after: 240 },
    }),
  ];
}

function h(t) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text: t, bold: true, size: 26, color: "0C4A6E" })],
  });
}

function h2(t) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 180, after: 90 },
    children: [new TextRun({ text: t, bold: true, size: 24, color: "0369A1" })],
  });
}

function p(t) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text: t, size: 22 })],
  });
}

function b(t) {
  return new Paragraph({
    spacing: { after: 70 },
    indent: { left: 280 },
    children: [new TextRun({ text: `• ${t}`, size: 22 })],
  });
}

function caption(t) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 200 },
    children: [new TextRun({ text: t, italics: true, size: 18, color: "64748B" })],
  });
}

function img(name, w, h) {
  const full = path.join(FIGURES, name);
  if (!fs.existsSync(full)) return p(`[Figure missing: ${name}]`);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 40 },
    children: [
      new ImageRun({
        type: "png",
        data: fs.readFileSync(full),
        transformation: { width: w, height: h },
        altText: { title: name, description: name, name },
      }),
    ],
  });
}

async function main() {
  const children = [
    ...title(
      "JUST RMS — Solutions Architecture",
      "Scalable, secure, modern design for Jamhuriya Research Management System"
    ),
    p(
      "Prepared as a Senior Solutions Architecture recommendation for the university research lifecycle platform (proposals, ethics, multi-stage review, projects, grants, finance, publications). Grounded in the current MERN implementation, with a target architecture for scale and security."
    ),

    h("1. Executive summary"),
    p(
      "JUST RMS should remain a modular web platform with clear separation of presentation, API, and data. The recommended stack is a React SPA, Node.js/Express (or NestJS evolution) API, MongoDB for document-centric research records, JWT auth with role + portal scoping, and optional Redis/object storage as the system grows."
    ),
    b("Current fit: MERN matches research document workflows and fast iteration for a thesis-grade institutional system."),
    b("Scale path: keep monolith API first; extract workers (PDF, email, analytics) when load requires it."),
    b("Security baseline: least privilege roles, portal isolation (UG/PG), assign-first review gates, HTTPS, secrets in env, audit trail."),

    h("2. High-level architecture"),
    img("arch-current.png", 620, 349),
    caption("Figure 1. Logical layers (Frontend / API / Database)"),
    h2("2.1 Presentation layer (Frontend)"),
    b("SPA for dashboards, proposal review, finance queues, ethics, projects, publications"),
    b("Portal selection for shared staff (Undergraduate / Postgraduate)"),
    b("Role-based route guards; all roles land on Dashboard after auth"),
    h2("2.2 Application layer (Backend API)"),
    b("REST API under /api/* with JWT authentication"),
    b("Domain modules: auth, users, proposals, ethics, projects, funding, grants, budgets, payments, publications, repository, groups, thesis, analytics, notifications, audit"),
    b("Business rules: multi-stage review (peer → committee → finance for grants), assign-first, ethics separate from faculty committee"),
    h2("2.3 Data layer"),
    b("MongoDB collections scoped by programTier"),
    b("File uploads for proposals/repository; certificate PDFs for ethics"),
    img("db-current.png", 620, 349),
    caption("Figure 2. Core data relationships"),

    h("3. Recommended tech stack"),
    h2("3.1 Frontend (recommended)"),
    b("Primary: React 18/19 + Vite (current) — fast DX, strong ecosystem"),
    b("Routing: React Router; HTTP: Axios; charts: Recharts"),
    b("Optional upgrades: React Query/TanStack Query for server state; Zod for form/API validation; Playwright for E2E"),
    b("UI: keep institutional design system; avoid heavy UI kits that fight brand guidelines"),
    h2("3.2 Backend (recommended)"),
    b("Primary: Node.js + Express (current) — proven for this codebase"),
    b("Evolution path: NestJS if team wants stricter modules, DI, OpenAPI-first contracts"),
    b("Auth: JWT access + refresh; bcrypt password hashing; role middleware"),
    b("Uploads: Multer → disk now; migrate to S3-compatible object storage for production scale"),
    b("Jobs: BullMQ + Redis for email, PDF, large exports (add when needed)"),
    h2("3.3 Database (recommended)"),
    b("Primary: MongoDB Atlas (managed) — fits nested reviewPipeline, assignees, ethics forms"),
    b("Indexes: programTier + status + foreign keys (proposalId, projectId, researcherId)"),
    b("Optional later: Redis cache for dashboards; OpenSearch for global search at scale"),
    h2("3.4 Infrastructure"),
    b("Dev: local Node + MongoDB"),
    b("Prod: Render/Fly/Azure App Service + MongoDB Atlas; CDN for static SPA"),
    b("Secrets: environment variables / secret manager — never commit passwords"),
    b("Observability: structured logs, health endpoint, audit collection (already present)"),

    h("4. Security architecture"),
    b("Transport: HTTPS only in production; secure cookies if refresh stored client-side"),
    b("Identity: JWT short-lived access tokens; rotate refresh; revoke on logout"),
    b("Authorization: role + resource checks; assign-first for peer/committee/finance"),
    b("Portal isolation: X-Program-Tier for shared staff; researchers locked to programTier"),
    b("Input: validate payloads; limit upload types/sizes; sanitize file names"),
    b("Data: least privilege DB user; backup/retention policy; PII minimization in logs"),
    b("Compliance: ethics certificates, audit events for sensitive decisions"),

    h("5. Scalability design"),
    b("Phase 1 (now): modular monolith API + SPA + MongoDB — correct for university load"),
    b("Phase 2: horizontal API replicas behind load balancer; Atlas replica set; object storage for files"),
    b("Phase 3: async workers for certificates/notifications/reports; rate limiting; CDN"),
    b("Do not microservices-split early — boundaries should follow domains (proposals, finance, repository) only when team/ops demand it"),

    h("6. Domain flows (core)"),
    img("flow-current.png", 620, 349),
    caption("Figure 3. Proposal multi-stage review (current product rule)"),
    b("Voluntary: peer → committee → director approve (finance skipped)"),
    b("Grant: peer → committee → finance → director approve → project → budgets/payments"),
    b("Closure: director checklist → finance clear → project closed"),

    h("7. Frontend architecture guidelines"),
    b("Feature folders by domain (proposals, finance, projects)"),
    b("Shared auth/portal hooks; central API client with auth + tier headers"),
    b("ProtectedRoute by role; keep finance deep-links under /finance/*"),
    b("Prefer server truth for counts (peer queues aligned Director/Leadership)"),

    h("8. Backend architecture guidelines"),
    b("Routes → controllers → models/utils; keep pipeline helpers shared"),
    b("Explicit authorizeRoles on sensitive POSTs"),
    b("Idempotent notifications where possible; audit every director/finance decision"),
    b("OpenAPI/Swagger generation recommended for stakeholder integration"),

    h("9. Database design principles"),
    b("Document model for proposal reviewPipeline and ethics forms"),
    b("Reference integrity via ObjectId refs (proposalId, projectId, userId)"),
    b("programTier on business documents for portal queries"),
    b("Unique sparse links where 1:1 required (ethics↔proposal, publication↔project)"),
    b("Avoid soft-passing review stages from unrelated modules (ethics ≠ committee)"),

    h("10. Target reference stack (summary)"),
    b("Frontend: React + Vite + React Router + Axios (+ TanStack Query)"),
    b("Backend: Node.js + Express (NestJS optional migration)"),
    b("DB: MongoDB Atlas + Mongoose"),
    b("Auth: JWT + bcrypt + role/portal middleware"),
    b("Files: S3-compatible storage (production)"),
    b("Cache/jobs: Redis + BullMQ (when needed)"),
    b("Hosting: container or PaaS + CDN; CI/CD from GitHub"),

    h("11. Alignment with current JUST RMS"),
    p(
      "The running system already implements the recommended core: MERN, JWT, UG/PG portals, assign-first Phase-3 review, finance-separated queues, and MongoDB domain collections. This architecture document endorses that foundation and defines the secure scale-out path without discarding the working product."
    ),
    b("Companion docs: SYSTEM_COMPLETE.docx, SYSTEM_ARCHITECTURE_CURRENT.docx, DATABASE_STRUCTURE.docx, SYSTEM_HOW_IT_WORKS.docx"),
  ];

  const doc = new Document({
    creator: "JUST RMS Solutions Architecture",
    title: "JUST RMS Solutions Architecture",
    sections: [
      {
        properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } },
        children,
      },
    ],
  });

  const out = path.join(DOCS, "SOLUTIONS_ARCHITECTURE.docx");
  fs.writeFileSync(out, await Packer.toBuffer(doc));
  console.log("Written:", out, fs.statSync(out).size);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

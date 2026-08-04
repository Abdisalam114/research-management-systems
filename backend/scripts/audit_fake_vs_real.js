/**
 * Audit all research records — classify seed/fake vs user-created.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const {
  UNDERGRADUATE_PROPOSALS,
  POSTGRADUATE_PROPOSALS,
  PUBLICATION_TEMPLATES,
  GRANT_TEMPLATES,
} = require("../src/scripts/seedRecords");

const SEED_DOI = /^10\.1000\/rms\./i;
const SHELL_MARKERS = [/Research Outputs/i, /linked from publication/i, /Seeded voluntary proposal/i];

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const seedProposalTitles = new Set(
  [...UNDERGRADUATE_PROPOSALS, ...POSTGRADUATE_PROPOSALS].map((p) => norm(p.title))
);
const seedPubTitles = new Set(PUBLICATION_TEMPLATES.map((p) => norm(p.title)));
const seedGrantTitles = new Set(GRANT_TEMPLATES.map((g) => norm(g.title)));

function isShellProposal(p) {
  if (!p) return false;
  const abs = String(p.abstract || "");
  return (
    p.researchArea === "Research Outputs" ||
    SHELL_MARKERS.some((re) => re.test(abs))
  );
}

function classifyProject(project, proposal) {
  const t = norm(project.title);
  if (seedProposalTitles.has(t)) return "seed_template";
  if (isShellProposal(proposal)) return "shell_fake";
  return "user_created";
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const projects = await db.collection("projects").find({}).toArray();
  const proposals = await db.collection("proposals").find({}).toArray();
  const pubs = await db.collection("publications").find({}).toArray();
  const grants = await db.collection("grants").find({}).toArray();
  const budgets = await db.collection("budgets").find({}).toArray();
  const ethics = await db.collection("ethicsapplications").find({}).toArray();

  const propById = Object.fromEntries(proposals.map((p) => [String(p._id), p]));

  const projectRows = projects.map((p) => {
    const prop = propById[String(p.proposalId)] || null;
    return {
      id: String(p._id),
      title: p.title,
      status: p.status,
      createdAt: p.createdAt,
      kind: classifyProject(p, prop),
      proposalKind: prop?.proposalKind || null,
    };
  });

  const pubRows = pubs.map((p) => ({
    id: String(p._id),
    title: p.title,
    projectId: p.projectId ? String(p.projectId) : null,
    doi: p.doi || "",
    createdAt: p.createdAt,
    kind: SEED_DOI.test(p.doi || "")
      ? "seed_doi"
      : seedPubTitles.has(norm(p.title))
        ? "seed_template"
        : "user_created",
  }));

  const summary = {
    projects: {
      total: projects.length,
      seed_template: projectRows.filter((r) => r.kind === "seed_template").length,
      shell_fake: projectRows.filter((r) => r.kind === "shell_fake").length,
      user_created: projectRows.filter((r) => r.kind === "user_created").length,
    },
    proposals: {
      total: proposals.length,
      seed_template: proposals.filter((p) => seedProposalTitles.has(norm(p.title))).length,
      shell_fake: proposals.filter(isShellProposal).length,
      other: proposals.filter(
        (p) => !seedProposalTitles.has(norm(p.title)) && !isShellProposal(p)
      ).length,
    },
    publications: {
      total: pubs.length,
      seed: pubRows.filter((r) => r.kind !== "user_created").length,
      user_created: pubRows.filter((r) => r.kind === "user_created").length,
    },
    grants: grants.length,
    budgets: budgets.length,
    ethics: ethics.length,
    keepProjects: projectRows.filter((r) => r.kind === "user_created"),
    removeProjects: projectRows.filter((r) => r.kind !== "user_created"),
  };

  const payload = {
    sessionId: "f558f7",
    hypothesisId: "FAKE1",
    message: "fake vs real data audit",
    data: summary,
    timestamp: Date.now(),
  };

  fs.appendFileSync(path.join(__dirname, "..", "..", "debug-f558f7.log"), `${JSON.stringify(payload)}\n`);
  console.log(JSON.stringify({ summary, keepProjects: summary.keepProjects, removeProjects: summary.removeProjects }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

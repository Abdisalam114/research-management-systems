/**
 * Remove institutional seed/fake research data; keep user-created records only.
 * Does NOT remove users, departments, or login accounts.
 * Run: node scripts/removeAllFakeSeedData.js [--dry-run]
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const {
  UNDERGRADUATE_PROPOSALS,
  POSTGRADUATE_PROPOSALS,
  PUBLICATION_TEMPLATES,
  GRANT_TEMPLATES,
  COLLABORATION_GROUPS,
  THESIS_GROUPS,
  FUNDING_CALL_TEMPLATES,
  REPOSITORY_ITEMS,
} = require("../src/scripts/seedRecords");

const DRY = process.argv.includes("--dry-run");
const SEED_DOI = /^10\.1000\/rms\./i;
const SHELL_MARKERS = [/Research Outputs/i, /linked from publication/i, /Seeded voluntary proposal/i];
const LOG = path.join(__dirname, "..", "..", "debug-f558f7.log");

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
const seedGroupNames = new Set(COLLABORATION_GROUPS.map((g) => norm(g.name)));
const seedThesisTitles = new Set(THESIS_GROUPS.map((g) => norm(g.title)));
const seedFundingCallTitles = new Set(FUNDING_CALL_TEMPLATES.map((f) => norm(f.title)));
const seedRepositoryTitles = new Set(REPOSITORY_ITEMS.map((r) => norm(r.title)));

function isShellProposal(p) {
  if (!p) return false;
  const abs = String(p.abstract || "");
  return p.researchArea === "Research Outputs" || SHELL_MARKERS.some((re) => re.test(abs));
}

function isFakeProject(project, proposal) {
  if (!project) return false;
  if (seedProposalTitles.has(norm(project.title))) return true;
  if (isShellProposal(proposal)) return true;
  return false;
}

function isFakeProposal(p) {
  if (!p) return false;
  if (seedProposalTitles.has(norm(p.title))) return true;
  if (isShellProposal(p)) return true;
  return false;
}

function isFakePublication(p) {
  if (SEED_DOI.test(p.doi || "")) return true;
  if (seedPubTitles.has(norm(p.title))) return true;
  return false;
}

function isFakeGrant(g) {
  return seedGrantTitles.has(norm(g.title));
}

function log(message, data) {
  fs.appendFileSync(
    LOG,
    `${JSON.stringify({ sessionId: "f558f7", hypothesisId: "FAKE2", message, data, timestamp: Date.now() })}\n`
  );
}

async function delMany(db, col, filter, label, summary) {
  const count = await db.collection(col).countDocuments(filter);
  if (count && !DRY) await db.collection(col).deleteMany(filter);
  summary[label] = (summary[label] || 0) + count;
  return count;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const summary = { dryRun: DRY, removed: {}, kept: {} };

  const projects = await db.collection("projects").find({}).toArray();
  const proposals = await db.collection("proposals").find({}).toArray();
  const propById = Object.fromEntries(proposals.map((p) => [String(p._id), p]));

  const fakeProjectIds = [];
  const keepProjectIds = [];
  for (const p of projects) {
    const prop = propById[String(p.proposalId)] || null;
    if (isFakeProject(p, prop)) fakeProjectIds.push(p._id);
    else keepProjectIds.push(p._id);
  }

  const fakeProposalIds = proposals.filter(isFakeProposal).map((p) => p._id);
  const keepProposalIds = proposals.filter((p) => !isFakeProposal(p)).map((p) => p._id);

  summary.kept.projects = keepProjectIds.map(String);
  summary.kept.proposals = keepProposalIds.map(String);

  const fakeProjectIdStr = new Set(fakeProjectIds.map(String));

  // Publications: remove seed/fake + any on fake projects
  const pubs = await db.collection("publications").find({}).toArray();
  const fakePubIds = pubs
    .filter(
      (p) =>
        isFakePublication(p) ||
        (p.projectId && fakeProjectIdStr.has(String(p.projectId)))
    )
    .map((p) => p._id);
  const keepPubIds = pubs.filter((p) => !fakePubIds.some((id) => String(id) === String(p._id))).map((p) => p._id);
  summary.kept.publications = keepPubIds.map(String);

  if (fakePubIds.length) {
    await delMany(db, "publications", { _id: { $in: fakePubIds } }, "publications", summary.removed);
  }

  // Project-scoped children
  if (fakeProjectIds.length) {
    await delMany(db, "repositoryitems", { projectId: { $in: fakeProjectIds } }, "repositoryitems", summary.removed);
    await delMany(db, "budgets", { projectId: { $in: fakeProjectIds } }, "budgets_by_project", summary.removed);
    await delMany(db, "grants", { projectId: { $in: fakeProjectIds } }, "grants_by_project", summary.removed);
    await delMany(db, "ethicsapplications", { projectId: { $in: fakeProjectIds } }, "ethics_by_project", summary.removed);
  }

  // Proposal-scoped ethics
  if (fakeProposalIds.length) {
    await delMany(
      db,
      "ethicsapplications",
      { proposalId: { $in: fakeProposalIds } },
      "ethics_by_proposal",
      summary.removed
    );
  }

  // Seed template grants not on kept projects
  const grants = await db.collection("grants").find({}).toArray();
  const fakeGrantIds = grants
    .filter(
      (g) =>
        isFakeGrant(g) ||
        (g.projectId && fakeProjectIdStr.has(String(g.projectId)))
    )
    .map((g) => g._id);
  if (fakeGrantIds.length) {
    await delMany(db, "budgets", { grantId: { $in: fakeGrantIds } }, "budgets_by_grant", summary.removed);
    await delMany(db, "payments", { grantId: { $in: fakeGrantIds } }, "payments", summary.removed);
    await delMany(db, "purchaseorders", { grantId: { $in: fakeGrantIds } }, "purchaseorders", summary.removed);
    await delMany(db, "grants", { _id: { $in: fakeGrantIds } }, "grants", summary.removed);
  }

  // Seed repository items by title (including any orphans after project delete)
  const repos = await db.collection("repositoryitems").find({}).toArray();
  const keepProjectIdStr = new Set(keepProjectIds.map(String));
  const seedRepoIds = repos
    .filter((r) => {
      if (!seedRepositoryTitles.has(norm(r.title))) return false;
      if (r.projectId && keepProjectIdStr.has(String(r.projectId))) return false;
      return true;
    })
    .map((r) => r._id);
  if (seedRepoIds.length) {
    await delMany(db, "repositoryitems", { _id: { $in: seedRepoIds } }, "repository_seed", summary.removed);
  }

  // Projects & proposals
  if (fakeProjectIds.length) {
    await delMany(db, "projects", { _id: { $in: fakeProjectIds } }, "projects", summary.removed);
  }
  if (fakeProposalIds.length) {
    await delMany(db, "proposals", { _id: { $in: fakeProposalIds } }, "proposals", summary.removed);
  }

  // Seed collaboration / thesis groups
  const groups = await db.collection("researchgroups").find({}).toArray();
  const fakeGroupIds = groups.filter((g) => seedGroupNames.has(norm(g.name))).map((g) => g._id);
  if (fakeGroupIds.length) {
    await delMany(db, "researchgroups", { _id: { $in: fakeGroupIds } }, "researchgroups", summary.removed);
  }

  const thesis = await db.collection("thesisgroups").find({}).toArray();
  const fakeThesisIds = thesis.filter((t) => seedThesisTitles.has(norm(t.title))).map((t) => t._id);
  if (fakeThesisIds.length) {
    await delMany(db, "thesisgroups", { _id: { $in: fakeThesisIds } }, "thesisgroups", summary.removed);
  }

  // Seed funding calls (keep if linked to kept grant/project — check after grant cleanup)
  const fundingCalls = await db.collection("fundingcalls").find({}).toArray();
  const remainingGrants = await db.collection("grants").find({}).project({ fundingCallId: 1 }).toArray();
  const usedCallIds = new Set(
    remainingGrants.map((g) => (g.fundingCallId ? String(g.fundingCallId) : "")).filter(Boolean)
  );
  const fakeCallIds = fundingCalls
    .filter((f) => seedFundingCallTitles.has(norm(f.title)) && !usedCallIds.has(String(f._id)))
    .map((f) => f._id);
  if (fakeCallIds.length) {
    await delMany(db, "fundingcalls", { _id: { $in: fakeCallIds } }, "fundingcalls", summary.removed);
  }

  // Final counts
  summary.after = {
    projects: await db.collection("projects").countDocuments(),
    proposals: await db.collection("proposals").countDocuments(),
    publications: await db.collection("publications").countDocuments(),
    grants: await db.collection("grants").countDocuments(),
    budgets: await db.collection("budgets").countDocuments(),
    ethics: await db.collection("ethicsapplications").countDocuments(),
    repository: await db.collection("repositoryitems").countDocuments(),
    researchgroups: await db.collection("researchgroups").countDocuments(),
    thesisgroups: await db.collection("thesisgroups").countDocuments(),
    fundingcalls: await db.collection("fundingcalls").countDocuments(),
    users: await db.collection("users").countDocuments(),
    departments: await db.collection("departments").countDocuments(),
  };

  log(DRY ? "dry-run fake seed cleanup" : "fake seed cleanup complete", summary);
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Repair projectId on grants, publications, repository items, and budgets
 * using the same index formula as seed.js (proposalDefs[i % len]).
 * Clears projectId when the linked proposal has no project (e.g. draft / under review).
 */
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const { connectDB } = require("../config/db");
const { Grant } = require("../models/Grant");
const { Publication } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const { Budget } = require("../models/Budget");
const { Proposal } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { PROGRAM_TIERS } = require("./seedData");
const {
  RECORDS_PER_TIER,
  GRANT_TEMPLATES,
  PUBLICATION_TEMPLATES,
  REPOSITORY_ITEMS,
  proposalsForTier,
} = require("./seedRecords");

const LOG_PATH = path.join(__dirname, "../../../debug-15a9cf.log");

function logRepair(entry) {
  try {
    fs.appendFileSync(
      LOG_PATH,
      `${JSON.stringify({ sessionId: "15a9cf", ...entry, timestamp: Date.now() })}\n`
    );
  } catch (_) {}
}

function templateIndex(templates, title) {
  const idx = templates.findIndex((t) => t.title === title);
  return idx >= 0 ? idx : null;
}

async function expectedProjectForSeedIndex(programTier, researcherId, seedIndex) {
  const proposalDefs = proposalsForTier(programTier);
  const proposalTpl = proposalDefs[seedIndex % proposalDefs.length];
  const proposal = await Proposal.findOne({
    programTier,
    title: proposalTpl.title,
    researcherId,
  });
  if (!proposal) return null;
  return Project.findOne({ proposalId: proposal._id });
}

async function repairCollection({
  programTier,
  Model,
  templates,
  ownerField,
  label,
}) {
  const docs = await Model.find({ programTier, title: { $in: templates.map((t) => t.title) } });
  let updated = 0;
  let cleared = 0;
  const mismatches = [];

  for (const doc of docs) {
    const idx = templateIndex(templates, doc.title);
    if (idx == null) continue;

    const researcherId = doc[ownerField];
    const expected = await expectedProjectForSeedIndex(programTier, researcherId, idx);
    const expectedId = expected?._id ? String(expected._id) : null;
    const currentId = doc.projectId ? String(doc.projectId) : null;

    if (currentId === expectedId) continue;

    mismatches.push({
      label,
      title: doc.title.slice(0, 50),
      from: currentId,
      to: expectedId,
    });

    doc.projectId = expected?._id || null;
    await doc.save();
    updated += 1;
    if (!expectedId) cleared += 1;
  }

  return { updated, cleared, mismatches };
}

async function repairBudgets(programTier) {
  const budgets = await Budget.find({ programTier, grantId: { $ne: null } });
  let updated = 0;
  for (const budget of budgets) {
    const grant = await Grant.findById(budget.grantId).select("projectId");
    const expectedId = grant?.projectId ? String(grant.projectId) : null;
    const currentId = budget.projectId ? String(budget.projectId) : null;
    if (currentId === expectedId) continue;
    budget.projectId = grant?.projectId || null;
    await budget.save();
    updated += 1;
  }
  return updated;
}

async function auditIntegrity(programTier) {
  const issues = [];
  const projects = await Project.find({ programTier }).select("title researcherId");

  for (const project of projects) {
    const [grants, pubs, repos] = await Promise.all([
      Grant.find({ projectId: project._id }).select("title researcherId"),
      Publication.find({ projectId: project._id }).select("title researcherId"),
      RepositoryItem.find({ projectId: project._id }).select("title uploadedBy"),
    ]);

    for (const g of grants) {
      const idx = templateIndex(GRANT_TEMPLATES, g.title);
      if (idx == null) continue;
      const expected = await expectedProjectForSeedIndex(programTier, g.researcherId, idx);
      if (String(expected?._id || "") !== String(project._id)) {
        issues.push({ type: "grant", project: project.title.slice(0, 40), grant: g.title.slice(0, 40) });
      }
    }
    for (const p of pubs) {
      const idx = templateIndex(PUBLICATION_TEMPLATES, p.title);
      if (idx == null) continue;
      const expected = await expectedProjectForSeedIndex(programTier, p.researcherId, idx);
      if (String(expected?._id || "") !== String(project._id)) {
        issues.push({ type: "publication", project: project.title.slice(0, 40), record: p.title.slice(0, 40) });
      }
    }
    for (const r of repos) {
      const idx = templateIndex(REPOSITORY_ITEMS, r.title);
      if (idx == null) continue;
      const expected = await expectedProjectForSeedIndex(programTier, r.uploadedBy, idx);
      if (String(expected?._id || "") !== String(project._id)) {
        issues.push({ type: "repository", project: project.title.slice(0, 40), record: r.title.slice(0, 40) });
      }
    }
  }

  return issues;
}

async function main() {
  await connectDB(process.env.MONGO_URI || process.env.MONGODB_URI);

  logRepair({
    location: "repairProjectScopedLinks.js:main",
    message: "repair start",
    hypothesisId: "H1-grant-mismatch",
    runId: "repair-pre",
  });

  const beforeIssues = [];
  for (const tier of Object.values(PROGRAM_TIERS)) {
    beforeIssues.push(...(await auditIntegrity(tier)));
  }

  logRepair({
    location: "repairProjectScopedLinks.js:audit",
    message: "pre-repair mismatches",
    data: { count: beforeIssues.length, sample: beforeIssues.slice(0, 8) },
    hypothesisId: "H1-grant-mismatch",
    runId: "repair-pre",
  });

  const summary = {};
  for (const tier of Object.values(PROGRAM_TIERS)) {
    const grants = await repairCollection({
      programTier: tier,
      Model: Grant,
      templates: GRANT_TEMPLATES.slice(0, RECORDS_PER_TIER),
      ownerField: "researcherId",
      label: "grant",
    });
    const pubs = await repairCollection({
      programTier: tier,
      Model: Publication,
      templates: PUBLICATION_TEMPLATES.slice(0, RECORDS_PER_TIER),
      ownerField: "researcherId",
      label: "publication",
    });
    const repos = await repairCollection({
      programTier: tier,
      Model: RepositoryItem,
      templates: REPOSITORY_ITEMS.slice(0, RECORDS_PER_TIER),
      ownerField: "uploadedBy",
      label: "repository",
    });
    const budgets = await repairBudgets(tier);

    summary[tier] = {
      grants: grants.updated,
      grantsCleared: grants.cleared,
      publications: pubs.updated,
      repository: repos.updated,
      budgets,
      grantFixes: grants.mismatches.slice(0, 5),
    };

    console.log(
      `${tier}: grants=${grants.updated} (cleared ${grants.cleared}), pubs=${pubs.updated}, repo=${repos.updated}, budgets=${budgets}`
    );
  }

  const afterIssues = [];
  for (const tier of Object.values(PROGRAM_TIERS)) {
    afterIssues.push(...(await auditIntegrity(tier)));
  }

  logRepair({
    location: "repairProjectScopedLinks.js:audit",
    message: "post-repair mismatches",
    data: { count: afterIssues.length, summary },
    hypothesisId: "H1-grant-mismatch",
    runId: "repair-post",
  });

  console.log(`Integrity: before=${beforeIssues.length} after=${afterIssues.length}`);
  process.exit(afterIssues.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

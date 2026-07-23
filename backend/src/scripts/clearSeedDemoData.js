/**
 * Remove ONLY seeded demo research records for a portal.
 * Keeps user-entered records (titles not in seed templates).
 *
 * Usage:
 *   node src/scripts/clearSeedDemoData.js              # postgraduate (default)
 *   node src/scripts/clearSeedDemoData.js postgraduate
 *   node src/scripts/clearSeedDemoData.js undergraduate
 *   node src/scripts/clearSeedDemoData.js both
 */
const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const { connectDB } = require("../config/db");
const { PROGRAM_TIERS } = require("../constants/programTier");
const { Proposal } = require("../models/Proposal");
const { Project } = require("../models/Project");
const { Grant } = require("../models/Grant");
const { Budget } = require("../models/Budget");
const { Publication } = require("../models/Publication");
const { ResearchGroup } = require("../models/ResearchGroup");
const { ThesisGroup } = require("../models/ThesisGroup");
const { RepositoryItem } = require("../models/RepositoryItem");
const { Notification } = require("../models/Notification");
const { EthicsApplication } = require("../models/EthicsApplication");
const { Payment } = require("../models/Payment");
const { FundingCall } = require("../models/FundingCall");
const { AuditEvent } = require("../models/AuditEvent");
const { PurchaseOrder } = require("../models/PurchaseOrder");
const {
  GRANT_TEMPLATES,
  PUBLICATION_TEMPLATES,
  COLLABORATION_GROUPS,
  THESIS_GROUPS,
  REPOSITORY_ITEMS,
  NOTIFICATION_TEMPLATES,
  FUNDING_CALL_TEMPLATES,
  proposalsForTier,
} = require("./seedRecords");

function titleSet(items, key = "title") {
  return [...new Set(items.map((x) => String(x[key] || "").trim()).filter(Boolean))];
}

async function deleteByTitles(Model, programTier, titles, label) {
  if (!titles.length) return { deleted: 0, keptPreview: [] };
  const filter = { programTier, title: { $in: titles } };
  const matched = await Model.find(filter).select("_id title").lean();
  const ids = matched.map((d) => d._id);
  if (!ids.length) {
    console.log(`  ${label}: 0 seed matches`);
    return { deleted: 0, ids: [], keptPreview: [] };
  }
  const res = await Model.collection.deleteMany({ _id: { $in: ids } });
  console.log(`  ${label}: deleted ${res.deletedCount} seed row(s)`);
  return { deleted: res.deletedCount || 0, ids, keptPreview: matched.map((m) => m.title) };
}

async function deleteByNames(Model, programTier, names, label) {
  if (!names.length) return { deleted: 0, ids: [] };
  const filter = { programTier, name: { $in: names } };
  const matched = await Model.find(filter).select("_id name").lean();
  const ids = matched.map((d) => d._id);
  if (!ids.length) {
    console.log(`  ${label}: 0 seed matches`);
    return { deleted: 0, ids: [] };
  }
  const res = await Model.collection.deleteMany({ _id: { $in: ids } });
  console.log(`  ${label}: deleted ${res.deletedCount} seed row(s)`);
  return { deleted: res.deletedCount || 0, ids };
}

async function clearTier(programTier) {
  console.log(`\n=== Clear seed demo only: ${programTier} ===`);

  const proposalTitles = titleSet(proposalsForTier(programTier));
  const grantTitles = titleSet(GRANT_TEMPLATES);
  const pubTitles = titleSet(PUBLICATION_TEMPLATES);
  const callTitles = titleSet(FUNDING_CALL_TEMPLATES);
  const thesisTitles = titleSet(THESIS_GROUPS);
  const repoTitles = titleSet(REPOSITORY_ITEMS);
  const groupNames = titleSet(COLLABORATION_GROUPS, "name");
  const notifTitles = titleSet(NOTIFICATION_TEMPLATES);

  // Collect seed proposal/project/grant ids first for related cleanup
  const seedProposals = await Proposal.find({ programTier, title: { $in: proposalTitles } })
    .select("_id")
    .lean();
  const seedProjects = await Project.find({
    programTier,
    $or: [{ title: { $in: proposalTitles } }, { proposalId: { $in: seedProposals.map((p) => p._id) } }],
  })
    .select("_id")
    .lean();
  const seedGrants = await Grant.find({ programTier, title: { $in: grantTitles } })
    .select("_id")
    .lean();

  const seedProposalIds = seedProposals.map((p) => p._id);
  const seedProjectIds = seedProjects.map((p) => p._id);
  const seedGrantIds = seedGrants.map((g) => g._id);

  // Related: ethics, budgets, payments, POs, audit tied to seed entities
  if (seedProposalIds.length) {
    const eth = await EthicsApplication.collection.deleteMany({
      programTier,
      proposalId: { $in: seedProposalIds },
    });
    console.log(`  ethics (via seed proposals): deleted ${eth.deletedCount || 0}`);
  }

  if (seedProjectIds.length || seedGrantIds.length) {
    const budgetFilter = {
      programTier,
      $or: [
        ...(seedProjectIds.length ? [{ projectId: { $in: seedProjectIds } }] : []),
        ...(seedGrantIds.length ? [{ grantId: { $in: seedGrantIds } }] : []),
      ],
    };
    const budgets = await Budget.find(budgetFilter).select("_id").lean();
    const budgetIds = budgets.map((b) => b._id);
    if (budgetIds.length) {
      const po = await PurchaseOrder.collection.deleteMany({ programTier, budgetId: { $in: budgetIds } });
      const pay = await Payment.collection.deleteMany({
        programTier,
        $or: [
          { budgetId: { $in: budgetIds } },
          ...(seedProjectIds.length ? [{ projectId: { $in: seedProjectIds } }] : []),
          ...(seedGrantIds.length ? [{ grantId: { $in: seedGrantIds } }] : []),
        ],
      });
      const bud = await Budget.collection.deleteMany({ _id: { $in: budgetIds } });
      console.log(
        `  budgets/payments/POs (seed-linked): budgets=${bud.deletedCount || 0}, payments=${pay.deletedCount || 0}, POs=${po.deletedCount || 0}`
      );
    }
  }

  await deleteByTitles(Proposal, programTier, proposalTitles, "proposals");
  await deleteByTitles(Project, programTier, proposalTitles, "projects (seed titles)");
  if (seedProjectIds.length) {
    // catch seed projects linked by proposalId whose title may differ
    const extra = await Project.collection.deleteMany({ _id: { $in: seedProjectIds } });
    if (extra.deletedCount) console.log(`  projects (via seed proposalId): deleted ${extra.deletedCount}`);
  }
  await deleteByTitles(Grant, programTier, grantTitles, "grants");
  await deleteByTitles(Publication, programTier, pubTitles, "publications");
  await deleteByTitles(FundingCall, programTier, callTitles, "funding calls");
  await deleteByTitles(ThesisGroup, programTier, thesisTitles, "thesis groups");
  await deleteByTitles(RepositoryItem, programTier, repoTitles, "repository");
  await deleteByNames(ResearchGroup, programTier, groupNames, "research groups");

  const notif = await Notification.collection.deleteMany({
    programTier,
    title: { $in: notifTitles },
  });
  console.log(`  notifications (seed titles): deleted ${notif.deletedCount || 0}`);

  // Seed-style audit rows for wiped entities
  const audit = await AuditEvent.collection.deleteMany({
    programTier,
    $or: [
      ...(seedProposalIds.length ? [{ entityType: "proposal", entityId: { $in: seedProposalIds } }] : []),
      ...(seedProjectIds.length ? [{ entityType: "project", entityId: { $in: seedProjectIds } }] : []),
      ...(seedGrantIds.length ? [{ entityType: "grant", entityId: { $in: seedGrantIds } }] : []),
    ],
  });
  console.log(`  audit (seed entities): deleted ${audit.deletedCount || 0}`);

  // Report what remains (user data)
  const remain = {
    proposals: await Proposal.countDocuments({ programTier }),
    projects: await Project.countDocuments({ programTier }),
    grants: await Grant.countDocuments({ programTier }),
    fundingCalls: await FundingCall.countDocuments({ programTier }),
    publications: await Publication.countDocuments({ programTier }),
  };
  const sample = await Proposal.find({ programTier }).select("title").lean();
  console.log(`  remaining (kept):`, remain);
  console.log(
    `  kept proposal titles:`,
    sample.map((p) => p.title).join(" | ") || "(none)"
  );
}

async function main() {
  const arg = String(process.argv[2] || PROGRAM_TIERS.POSTGRADUATE).toLowerCase();
  await connectDB(process.env.MONGO_URI || process.env.MONGODB_URI);

  const tiers =
    arg === "both"
      ? [PROGRAM_TIERS.UNDERGRADUATE, PROGRAM_TIERS.POSTGRADUATE]
      : arg === "undergraduate" || arg === "ug"
        ? [PROGRAM_TIERS.UNDERGRADUATE]
        : [PROGRAM_TIERS.POSTGRADUATE];

  for (const tier of tiers) {
    await clearTier(tier);
  }

  console.log("\nDone. User-entered records kept; seed demo removed.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } finally {
      process.exit();
    }
  });

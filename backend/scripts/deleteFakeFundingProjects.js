require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { Project } = require("../src/models/Project");
const { Grant } = require("../src/models/Grant");
const { Budget } = require("../src/models/Budget");
const { Publication } = require("../src/models/Publication");
const { RepositoryItem } = require("../src/models/RepositoryItem");

const DEBUG_LOG = path.join(__dirname, "../../.cursor/debug-f558f7.log");
const RUN_ID = "fix-fake-projects";
const HYPOTHESIS_ID = "FP1";

const IDS = [
  "6a5cdbf9872cb6172f2e5dcf",
  "6a5cdbf9872cb6172f2e5dd3",
  "6a5cdbf9872cb6172f2e5dd7",
  "6a5cdbfa872cb6172f2e5ddb",
  "6a5cdbfa872cb6172f2e5ddf",
  "6a5cdbfa872cb6172f2e5de3",
  "6a5ce7661d9aeb59a1efad71",
];

function logAction(message, data) {
  const row = {
    sessionId: "f558f7",
    runId: RUN_ID,
    hypothesisId: HYPOTHESIS_ID,
    location: "scripts/deleteFakeFundingProjects.js",
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(DEBUG_LOG, `${JSON.stringify(row)}\n`);
  console.error(JSON.stringify(row));
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGO_URI missing");
  await mongoose.connect(uri);

  const summary = {
    runId: RUN_ID,
    hypothesisId: HYPOTHESIS_ID,
    targets: IDS.length,
    deleted: [],
    skipped: [],
    grantsUnlinked: 0,
    budgetsUnlinked: 0,
    notFound: [],
  };

  logAction("start delete fake funding-named projects", { ids: IDS });

  for (const id of IDS) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const entry = { id, reason: "invalid_object_id" };
      summary.skipped.push(entry);
      logAction("skip invalid id", entry);
      continue;
    }

    const oid = new mongoose.Types.ObjectId(id);
    const project = await Project.findById(oid).lean();
    if (!project) {
      summary.notFound.push(id);
      logAction("project not found", { id });
      continue;
    }

    const [pubCount, repoCount, grantCount, budgetCount] = await Promise.all([
      Publication.countDocuments({ projectId: oid }),
      RepositoryItem.countDocuments({ projectId: oid }),
      Grant.countDocuments({ projectId: oid }),
      Budget.countDocuments({ projectId: oid }),
    ]);

    const hasProposal = !!project.proposalId;
    const verify = {
      id,
      title: project.title,
      proposalId: project.proposalId || null,
      pubCount,
      repoCount,
      grantCount,
      budgetCount,
    };
    logAction("verified project before delete", verify);

    if (hasProposal || pubCount !== 0 || repoCount !== 0) {
      const entry = {
        id,
        reason: hasProposal
          ? "has_proposalId"
          : pubCount !== 0
            ? "has_publications"
            : "has_repos",
        ...verify,
      };
      summary.skipped.push(entry);
      logAction("skip project (not empty / has proposal)", entry);
      continue;
    }

    const grantRes = await Grant.updateMany({ projectId: oid }, { $set: { projectId: null } });
    const grantsUnlinked = grantRes.modifiedCount ?? grantRes.nModified ?? 0;
    summary.grantsUnlinked += grantsUnlinked;
    logAction("unlinked grants", { id, grantsUnlinked, matched: grantRes.matchedCount });

    const budgetRes = await Budget.updateMany({ projectId: oid }, { $set: { projectId: null } });
    const budgetsUnlinked = budgetRes.modifiedCount ?? budgetRes.nModified ?? 0;
    summary.budgetsUnlinked += budgetsUnlinked;
    logAction("unlinked budgets", { id, budgetsUnlinked, matched: budgetRes.matchedCount });

    const del = await Project.deleteOne({ _id: oid });
    const deleted = (del.deletedCount ?? 0) === 1;
    if (deleted) {
      summary.deleted.push({ id, title: project.title, grantsUnlinked, budgetsUnlinked });
      logAction("deleted project", { id, title: project.title, grantsUnlinked, budgetsUnlinked });
    } else {
      const entry = { id, reason: "delete_failed", del };
      summary.skipped.push(entry);
      logAction("delete failed", entry);
    }
  }

  logAction("summary", summary);
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  logAction("error", { error: String(err && err.message ? err.message : err) });
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});

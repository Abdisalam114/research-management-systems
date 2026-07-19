/**
 * CARE2: delete empty orphan duplicate projects + relink true title mismatches.
 * Usage: node src/scripts/repairCare2OrphanDuplicates.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { Project, PROJECT_STATUSES } = require("../models/Project");
const { Grant } = require("../models/Grant");
const { Publication } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");

const DEBUG_LOG = path.join(__dirname, "../../../debug-f558f7.log");
const RUN_ID = "careful-repair";
const CUTOFF = new Date("2026-07-19T00:00:00.000Z");

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function titlesMatch(a, b) {
  return normalize(a) === normalize(b) && normalize(a).length > 0;
}

function logChange(message, data) {
  const row = {
    sessionId: "f558f7",
    runId: RUN_ID,
    hypothesisId: "CARE2",
    location: "repairCare2OrphanDuplicates.js",
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(DEBUG_LOG, `${JSON.stringify(row)}\n`);
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI / MONGO_URI missing");
  await mongoose.connect(uri);

  const deletions = [];
  const relinks = [];

  // ---- Part 1: empty orphan duplicate projects ----
  const candidates = await Project.find({
    status: PROJECT_STATUSES.ACTIVE,
    createdAt: { $gte: CUTOFF },
  }).lean();

  const allGrants = await Grant.find({}).select("_id title projectId researcherId").lean();
  const grantTitlesNorm = new Set(
    allGrants.map((g) => normalize(g.title)).filter((t) => t.length > 0)
  );
  const projectIdsLinkedByGrant = new Set(
    allGrants.filter((g) => g.projectId).map((g) => String(g.projectId))
  );

  for (const project of candidates) {
    const pid = String(project._id);

    if (projectIdsLinkedByGrant.has(pid)) continue;

    const grantLinked = await Grant.countDocuments({ projectId: project._id });
    if (grantLinked > 0) continue;

    const [pubCount, repoCount] = await Promise.all([
      Publication.countDocuments({ projectId: project._id }),
      RepositoryItem.countDocuments({ projectId: project._id }),
    ]);
    if (pubCount > 0 || repoCount > 0) continue;

    const reports = Array.isArray(project.progressReports) ? project.progressReports : [];
    if (reports.length > 0) continue;

    const nTitle = normalize(project.title);
    if (!nTitle || !grantTitlesNorm.has(nTitle)) continue;

    // Empty orphan duplicate — delete
    await Project.deleteOne({ _id: project._id });

    const row = {
      projectId: pid,
      title: project.title,
      researcherId: project.researcherId ? String(project.researcherId) : null,
      status: project.status,
      createdAt: project.createdAt,
      pubCount,
      repoCount,
      progressReports: reports.length,
      grantLinks: 0,
      reason: "empty-orphan-duplicate-matching-grant-title",
    };
    deletions.push(row);
    logChange("deleted empty orphan duplicate project", row);
  }

  // ---- Part 2: true title-mismatch relinks ----
  // Only when: grant title equals SOME OTHER project title for SAME researcherId
  // and matching-title project exists, and current project title != grant title
  // Then set grant.projectId to the matching-title project.
  // Do NOT touch grants where no matching-title project exists for that researcher.

  const grantsWithProject = await Grant.find({ projectId: { $ne: null } });
  for (const grant of grantsWithProject) {
    const linked = await Project.findById(grant.projectId);
    if (!linked) continue;

    if (titlesMatch(grant.title, linked.title)) continue;
    // current project title != grant title (already true via !titlesMatch)

    const researcherProjects = await Project.find({
      researcherId: grant.researcherId,
      _id: { $ne: linked._id },
    });
    const matching = researcherProjects.find((p) => titlesMatch(p.title, grant.title));
    if (!matching) {
      // seed funding of research titles is OK — leave alone
      continue;
    }

    const beforeProjectId = String(grant.projectId);
    grant.projectId = matching._id;
    await grant.save();

    const row = {
      grantId: String(grant._id),
      grantTitle: grant.title,
      researcherId: String(grant.researcherId),
      fromProjectId: beforeProjectId,
      fromProjectTitle: linked.title,
      toProjectId: String(matching._id),
      toProjectTitle: matching.title,
      reason: "title-mismatch-relink-to-matching-title-project",
    };
    relinks.push(row);
    logChange("relinked grant to matching-title project", row);
  }

  const out = { deletions, relinks, deletionCount: deletions.length, relinkCount: relinks.length };
  console.log(JSON.stringify(out, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

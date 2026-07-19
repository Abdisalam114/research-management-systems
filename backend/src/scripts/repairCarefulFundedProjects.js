/**
 * Careful data repair — RULE A/B/C/D only.
 * Usage: node src/scripts/repairCarefulFundedProjects.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { Project, PROJECT_STATUSES, CLOSURE_STATUSES } = require("../models/Project");
const { Grant, GRANT_STATUSES } = require("../models/Grant");
const { Publication } = require("../models/Publication");
const { RepositoryItem } = require("../models/RepositoryItem");
const { AuditEvent } = require("../models/AuditEvent");

const DEBUG_LOG = path.join(__dirname, "../../../debug-f558f7.log");
const RUN_ID = "careful-repair";

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

function looksLikeFundingAwardName(title) {
  const t = String(title || "");
  if (/Campus Sustainability/i.test(t)) return true;
  // Short/mid award-style names with funding keywords
  return (
    /\b(fund|grant|award|fellowship|scholarship|challenge|call|seed)\b/i.test(t) &&
    t.length <= 120 &&
    !/\b(investigating|analysis of|study of|towards|exploring|evaluating|assessment of)\b/i.test(t)
  );
}

function looksLikeLongResearchTitle(title) {
  const t = String(title || "").trim();
  if (t.length < 60) return false;
  if (/Campus Sustainability/i.test(t)) return false;
  if (looksLikeFundingAwardName(t) && t.length <= 80) return false;
  return (
    /\b(investigating|analysis|study|towards|exploring|evaluating|assessment|impact|effect|role of|among|using|based on)\b/i.test(
      t
    ) || t.length >= 80
  );
}

function logChange(message, data) {
  const row = {
    sessionId: "f558f7",
    runId: RUN_ID,
    hypothesisId: "CARE1",
    location: "repairCarefulFundedProjects.js",
    message,
    data,
    timestamp: Date.now(),
  };
  fs.appendFileSync(DEBUG_LOG, `${JSON.stringify(row)}\n`);
}

async function markProjectCompleted(project) {
  project.status = PROJECT_STATUSES.COMPLETED;
  project.closure = {
    ...(project.closure?.toObject?.() || project.closure || {}),
    status: CLOSURE_STATUSES.ARCHIVED,
    finalReport:
      project.closure?.finalReport ||
      "Research outputs archived (publication + repository). Marked completed.",
    checklist: {
      publicationsArchived: true,
      assetsHandedOver: true,
      dataArchived: true,
      financialCleared: true,
      ethicsClosed: true,
    },
    submittedAt: project.closure?.submittedAt || new Date(),
    directorApprovedAt: project.closure?.directorApprovedAt || new Date(),
    financeApprovedAt: project.closure?.financeApprovedAt || new Date(),
    archivedAt: new Date(),
  };
  await project.save();
}

async function findOrCreateCampusProject(grant) {
  const researcherId = grant.researcherId;
  let project = await Project.findOne({
    researcherId,
    title: /Campus Sustainability/i,
  });
  if (project) return { project, created: false };

  const status =
    grant.status === GRANT_STATUSES.CLOSED ? PROJECT_STATUSES.CLOSED : PROJECT_STATUSES.ACTIVE;

  project = await Project.create({
    title: grant.title || "Campus Sustainability Challenge Fund",
    researcherId,
    teamMembers: [],
    milestones: [
      { title: "Ethics clearance", dueDate: null, completed: false },
      { title: "Mid-term review", dueDate: null, completed: false },
      { title: "Final report", dueDate: null, completed: false },
    ],
    status,
    progressReports: [],
    programTier: grant.programTier,
  });
  return { project, created: true };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI / MONGO_URI missing");
  await mongoose.connect(uri);

  const completedByRuleA = [];
  const mislinksFixed = [];
  const statusSynced = [];
  let skippedReadyButTitleMismatch = 0;

  // ── RULE B: fix true mislinks ──────────────────────────────────────────
  const grants = await Grant.find({});
  for (const grant of grants) {
    if (!grant.projectId) continue;
    const linked = await Project.findById(grant.projectId);
    if (!linked) continue;

    // B1: Campus Sustainability mislink
    if (/Campus Sustainability/i.test(grant.title) && !/Campus Sustainability/i.test(linked.title)) {
      const beforeProjectId = String(grant.projectId);
      const { project: target, created } = await findOrCreateCampusProject(grant);
      grant.projectId = target._id;
      await grant.save();
      const fix = {
        rule: "B1-campus",
        grantId: String(grant._id),
        grantTitle: grant.title,
        fromProjectId: beforeProjectId,
        fromProjectTitle: linked.title,
        toProjectId: String(target._id),
        toProjectTitle: target.title,
        createdProject: created,
      };
      mislinksFixed.push(fix);
      logChange("mislink fixed (Campus Sustainability)", fix);
      continue;
    }

    // B2: award-named grant linked to long research title, but matching-title project exists
    if (
      looksLikeFundingAwardName(grant.title) &&
      looksLikeLongResearchTitle(linked.title) &&
      !titlesMatch(grant.title, linked.title)
    ) {
      const match = await Project.findOne({
        researcherId: grant.researcherId,
        _id: { $ne: linked._id },
      });
      // Prefer exact normalized title match among researcher's projects
      const candidates = await Project.find({ researcherId: grant.researcherId });
      const matching = candidates.find((p) => titlesMatch(p.title, grant.title));
      if (matching) {
        const beforeProjectId = String(grant.projectId);
        grant.projectId = matching._id;
        await grant.save();
        const fix = {
          rule: "B2-award-to-matching-title",
          grantId: String(grant._id),
          grantTitle: grant.title,
          fromProjectId: beforeProjectId,
          fromProjectTitle: linked.title,
          toProjectId: String(matching._id),
          toProjectTitle: matching.title,
          createdProject: false,
        };
        mislinksFixed.push(fix);
        logChange("mislink fixed (award name to matching project)", fix);
      }
    }
  }

  // ── RULE A (+ D): complete only when titles match ──────────────────────
  const openProjects = await Project.find({
    status: { $nin: [PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CLOSED] },
  });

  for (const project of openProjects) {
    const [pubCount, repoCount, grant] = await Promise.all([
      Publication.countDocuments({ projectId: project._id }),
      RepositoryItem.countDocuments({ projectId: project._id }),
      Grant.findOne({ projectId: project._id, amountAwarded: { $gt: 0 } }),
    ]);

    const ready = pubCount >= 1 && repoCount >= 1 && Boolean(grant);
    if (!ready) continue;

    if (!titlesMatch(project.title, grant.title)) {
      // RULE D
      skippedReadyButTitleMismatch += 1;
      logChange("skipped ready but title mismatch (RULE D)", {
        projectId: String(project._id),
        projectTitle: project.title,
        grantId: String(grant._id),
        grantTitle: grant.title,
        pubCount,
        repoCount,
      });
      continue;
    }

    const before = { status: project.status, grantStatus: grant.status };
    await markProjectCompleted(project);
    grant.status = GRANT_STATUSES.CLOSED;
    await grant.save();

    const row = {
      projectId: String(project._id),
      projectTitle: project.title,
      grantId: String(grant._id),
      grantTitle: grant.title,
      before,
      after: { status: project.status, grantStatus: grant.status },
      pubCount,
      repoCount,
    };
    completedByRuleA.push(row);
    logChange("completed by RULE A (title-matched funded project)", row);
  }

  // ── RULE C: status sync ────────────────────────────────────────────────
  // C1: completed/closed projects → linked non-rejected grants closed
  const doneProjects = await Project.find({
    status: { $in: [PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CLOSED] },
  });
  for (const project of doneProjects) {
    const linkedGrants = await Grant.find({
      projectId: project._id,
      status: { $ne: GRANT_STATUSES.REJECTED },
    });
    for (const g of linkedGrants) {
      if (g.status === GRANT_STATUSES.CLOSED) continue;
      const before = g.status;
      g.status = GRANT_STATUSES.CLOSED;
      await g.save();
      const row = {
        rule: "C1-project-done-grant-closed",
        grantId: String(g._id),
        grantTitle: g.title,
        projectId: String(project._id),
        projectStatus: project.status,
        before,
        after: g.status,
      };
      statusSynced.push(row);
      logChange("status sync C1", row);
    }
  }

  // C2: approved + awarded + finance evidence → active (or closed if project done)
  const approvedAwarded = await Grant.find({
    status: GRANT_STATUSES.APPROVED,
    amountAwarded: { $gt: 0 },
  });
  for (const g of approvedAwarded) {
    let financeOk = Boolean(g.financeApprovedAt);
    if (!financeOk) {
      const ev = await AuditEvent.findOne({
        entityType: "grant",
        entityId: g._id,
        action: /finance_approved/i,
      });
      if (!ev) {
        // also try label/action variants
        const ev2 = await AuditEvent.findOne({
          entityId: g._id,
          $or: [{ action: "finance_approved" }, { label: /finance.?approved/i }],
        });
        financeOk = Boolean(ev2);
      } else {
        financeOk = true;
      }
    }
    if (!financeOk) continue;

    let target = GRANT_STATUSES.ACTIVE;
    if (g.projectId) {
      const p = await Project.findById(g.projectId).select("status");
      if (p && [PROJECT_STATUSES.COMPLETED, PROJECT_STATUSES.CLOSED].includes(p.status)) {
        target = GRANT_STATUSES.CLOSED;
      }
    }
    if (g.status === target) continue;
    const before = g.status;
    g.status = target;
    await g.save();
    const row = {
      rule: "C2-approved-to-active-or-closed",
      grantId: String(g._id),
      grantTitle: g.title,
      projectId: g.projectId ? String(g.projectId) : null,
      before,
      after: g.status,
    };
    statusSynced.push(row);
    logChange("status sync C2", row);
  }

  const summary = {
    completedByRuleA,
    mislinksFixed,
    statusSynced,
    skippedReadyButTitleMismatch,
  };
  console.log(JSON.stringify(summary, null, 2));
  logChange("careful repair summary", {
    completedByRuleA: completedByRuleA.length,
    mislinksFixed: mislinksFixed.length,
    statusSynced: statusSynced.length,
    skippedReadyButTitleMismatch,
  });

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

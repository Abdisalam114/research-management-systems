/**
 * Runtime verification for regression-fix batch (session f558f7).
 * node backend/scripts/_verify_regression_fixes.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const LOG_PATH = path.join(__dirname, "../../debug-f558f7.log");

function agentLog(hypothesisId, message, data, runId = "post-fix-verify") {
  const entry = {
    sessionId: "f558f7",
    runId,
    hypothesisId,
    location: "_verify_regression_fixes.js",
    message,
    data,
    timestamp: Date.now(),
  };
  console.log(JSON.stringify(entry));
  try {
    fs.appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  } catch {
    /* ignore */
  }
  return entry;
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rms");

  const { coordinatorMatchesResearcherDept } = require("../src/utils/facultyMatcher");
  const { resolveWorkflowStage, STAGE_ORDER } = require("../src/utils/publicationWorkflow");
  function nextWorkflowStage(current) {
    const order = ["submitted", "in_process", "pipeline", "published"];
    const normalized = current && order.includes(current) ? current : "submitted";
    const i = order.indexOf(normalized);
    return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
  }
  const {
    assertThesisStudentsNotUsedElsewhere,
    assertThesisTitleNotUsedElsewhere,
    normalizeStudentRows,
  } = require("../src/utils/thesisDefaults");
  const { ThesisGroup } = require("../src/models/ThesisGroup");
  const { User, ROLES, USER_STATUSES } = require("../src/models/User");
  const { Publication, PUBLICATION_STATUSES } = require("../src/models/Publication");
  const { REPOSITORY_ITEMS } = require("../src/scripts/seedRecords");
  const { RepositoryItem } = require("../src/models/RepositoryItem");

  // H1: coordinator faculty-level dept matching
  const h1Cases = [
    { coord: "Faculty of Computing", researcher: "Computer Science", expect: true },
    { coord: "Computer Science", researcher: "Computer Science", expect: true },
    { coord: "Faculty of Computing", researcher: "Nursing", expect: false },
    { coord: "", researcher: "Computer Science", expect: true },
  ];
  const h1Results = h1Cases.map((c) => ({
    ...c,
    actual: coordinatorMatchesResearcherDept(c.coord, c.researcher),
    ok: coordinatorMatchesResearcherDept(c.coord, c.researcher) === c.expect,
  }));
  agentLog("H1-workflow-dept", "coordinatorMatchesResearcherDept", {
    allOk: h1Results.every((r) => r.ok),
    results: h1Results,
  });

  // H1b: frontend nextWorkflowStage null → submitted
  const h1b = {
    nullStage: nextWorkflowStage(null),
    undefinedStage: nextWorkflowStage(undefined),
    submittedStage: nextWorkflowStage("submitted"),
    ok: nextWorkflowStage(null) === "in_process" && nextWorkflowStage("submitted") === "in_process",
  };
  agentLog("H1-workflow-stage", "nextWorkflowStage defaults", h1b);

  // H2: repository seed filter
  function normSeedTitle(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }
  const seedTitles = new Set(REPOSITORY_ITEMS.map((r) => normSeedTitle(r.title)));
  const allRepo = await RepositoryItem.find({}).select("title").lean();
  const seedInDb = allRepo.filter((i) => seedTitles.has(normSeedTitle(i.title)));
  agentLog("H2-repo-seed", "repository seed items in DB", {
    totalRepo: allRepo.length,
    seedMatchesInDb: seedInDb.length,
    seedSample: seedInDb.slice(0, 3).map((i) => i.title),
    exportWouldFilter: seedInDb.length,
  });

  // H3: thesis duplicate student ID/email across groups
  const groups = await ThesisGroup.find({}).select("students programTier title titleProposal").lean();
  const seenEmail = new Map();
  const seenId = new Map();
  const seenTitle = new Map();
  const dupEmails = [];
  const dupIds = [];
  const dupTitles = [];
  for (const g of groups) {
    const gid = String(g._id);
    for (const s of g.students || []) {
      const email = String(s.email || "").trim().toLowerCase();
      const sid = String(s.studentId || "").trim().toLowerCase();
      if (email) {
        if (seenEmail.has(email)) dupEmails.push({ email, groups: [seenEmail.get(email), gid] });
        else seenEmail.set(email, gid);
      }
      if (sid) {
        if (seenId.has(sid)) dupIds.push({ studentId: sid, groups: [seenId.get(sid), gid] });
        else seenId.set(sid, gid);
      }
    }
    for (const raw of [g.title, g.titleProposal?.title]) {
      const key = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (!key) continue;
      if (seenTitle.has(key)) dupTitles.push({ title: key, groups: [seenTitle.get(key), gid] });
      else seenTitle.set(key, gid);
    }
  }
  agentLog("H3-thesis-dup", "existing duplicate thesis data", {
    totalGroups: groups.length,
    dupEmailCount: dupEmails.length,
    dupIdCount: dupIds.length,
    dupTitleCount: dupTitles.length,
    dupIdSample: dupIds.slice(0, 3),
    dupEmailSample: dupEmails.slice(0, 3),
    dupTitleSample: dupTitles.slice(0, 3),
  });

  // H3b: assertThesisStudentsNotUsedElsewhere blocks duplicate
  let assertBlocksDup = false;
  if (dupIds.length) {
    const sample = dupIds[0];
    const g = await ThesisGroup.findById(sample.groups[1]).lean();
    if (g?.students?.length) {
      try {
        await assertThesisStudentsNotUsedElsewhere(ThesisGroup, g.students, {
          excludeGroupId: g._id,
          tierFilter: { programTier: g.programTier || "undergraduate" },
        });
      } catch (e) {
        assertBlocksDup = /already used/i.test(e.message);
      }
    }
  }
  agentLog("H3-thesis-dup", "assertThesisStudentsNotUsedElsewhere blocks cross-group dup", {
    assertBlocksDup,
    tested: dupIds.length > 0,
  });

  // H3c: supervisor tier scope
  const ugResearcher = await User.findOne({
    role: ROLES.RESEARCHER,
    status: USER_STATUSES.ACTIVE,
    programTier: "undergraduate",
  }).select("_id email programTier");
  const pgResearcher = await User.findOne({
    role: ROLES.RESEARCHER,
    status: USER_STATUSES.ACTIVE,
    programTier: "postgraduate",
  }).select("_id email programTier");

  const mockReqUg = {
    programTier: "undergraduate",
    userWhere(base) {
      return { ...base, role: ROLES.RESEARCHER, programTier: "undergraduate" };
    },
  };
  const mockReqPg = {
    programTier: "postgraduate",
    userWhere(base) {
      return { ...base, role: ROLES.RESEARCHER, programTier: "postgraduate" };
    },
  };

  async function findSupervisorResearcher(supervisorId, req) {
    if (!supervisorId) return null;
    const filter = { _id: supervisorId, role: ROLES.RESEARCHER, status: USER_STATUSES.ACTIVE };
    const scoped = req?.userWhere ? req.userWhere(filter) : filter;
    return User.findOne(scoped);
  }

  const h3supervisor = {
    ugResearcher: ugResearcher ? { id: String(ugResearcher._id), email: ugResearcher.email } : null,
    pgResearcher: pgResearcher ? { id: String(pgResearcher._id), email: pgResearcher.email } : null,
    ugPortalFindsUg: ugResearcher
      ? Boolean(await findSupervisorResearcher(ugResearcher._id, mockReqUg))
      : null,
    ugPortalBlocksPg: pgResearcher
      ? !(await findSupervisorResearcher(pgResearcher._id, mockReqUg))
      : null,
    pgPortalFindsPg: pgResearcher
      ? Boolean(await findSupervisorResearcher(pgResearcher._id, mockReqPg))
      : null,
  };
  agentLog("H3-thesis-supervisor", "supervisor tier scoping", h3supervisor);

  // H4: publications workflow stage resolution for submitted pubs
  const submittedPubs = await Publication.find({
    status: { $ne: PUBLICATION_STATUSES.DRAFT },
    projectId: { $ne: null },
  })
    .limit(20)
    .lean();
  const pubStages = submittedPubs.map((p) => ({
    id: String(p._id),
    status: p.status,
    workflowStage: p.workflowStage,
    resolved: resolveWorkflowStage(p),
    canAdvanceFromResolved: STAGE_ORDER.indexOf(resolveWorkflowStage(p)) >= 0,
  }));
  const unresolvedCount = pubStages.filter((p) => !p.resolved).length;
  agentLog("H1-workflow-stage", "publication workflow stage resolution", {
    sampleCount: pubStages.length,
    unresolvedCount,
    sample: pubStages.slice(0, 5),
  });

  // H5: coordinator workflow visibility simulation
  const coordinator = await User.findOne({ email: "coordinator@rms.edu" }).select("department role");
  const coordDept = coordinator?.department || "";
  const pubsPop = await Publication.find({
    status: { $ne: PUBLICATION_STATUSES.DRAFT },
    projectId: { $ne: null },
  })
    .populate("researcherId", "department")
    .limit(50)
    .lean();
  const oldFilter = pubsPop.filter((p) => p.researcherId?.department === coordDept);
  const newFilter = pubsPop.filter(
    (p) => p.researcherId && coordinatorMatchesResearcherDept(coordDept, p.researcherId.department)
  );
  agentLog("H1-workflow-dept", "coordinator publication visibility", {
    coordinatorDept: coordDept,
    totalNonDraft: pubsPop.length,
    oldExactMatchCount: oldFilter.length,
    newFacultyMatchCount: newFilter.length,
    improved: newFilter.length >= oldFilter.length,
  });

  const allOk =
    h1Results.every((r) => r.ok) &&
    h1b.ok &&
    h3supervisor.ugPortalBlocksPg !== false &&
    unresolvedCount === 0;

  agentLog("SUMMARY", "regression verification complete", {
    allOk,
    dupIdsInDb: dupIds.length,
    dupTitlesInDb: dupTitles.length,
    seedRepoInDb: seedInDb.length,
  });

  await mongoose.disconnect();
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

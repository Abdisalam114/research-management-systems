require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const DEBUG_LOG = path.join(__dirname, "../../debug-f558f7.log");

function log(hypothesisId, message, data) {
  const entry = {
    sessionId: "f558f7",
    runId: "thesis-audit",
    hypothesisId,
    location: "_probe_thesis_bugs.js",
    message,
    data,
    timestamp: Date.now(),
  };
  console.log(JSON.stringify(entry));
  try {
    fs.appendFileSync(DEBUG_LOG, `${JSON.stringify(entry)}\n`);
  } catch {
    /* ignore */
  }
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rms");
  const { User } = require("../src/models/User");
  const { Department } = require("../src/models/Department");
  const { ThesisGroup } = require("../src/models/ThesisGroup");
  const { matchFacultyByName, FACULTIES } = require("../src/utils/facultyMatcher");

  const coordinator = await User.findOne({ email: "coordinator@rms.edu" }).select("email role programTier");
  const director = await User.findOne({ email: "director@rms.edu" }).select("email role");
  log("H1", "users for thesis roles", {
    coordinator: coordinator ? { email: coordinator.email, role: coordinator.role, tier: coordinator.programTier } : null,
    director: director ? { email: director.email, role: director.role } : null,
    note: "listUsers route currently research_director only — coordinator gets 403",
  });

  const depts = await Department.find({}).limit(30).lean();
  const facultyBuckets = {};
  for (const f of FACULTIES) facultyBuckets[f] = 0;
  const mismatches = [];
  for (const d of depts) {
    const raw = d.faculty || "";
    const inCanon = FACULTIES.includes(raw);
    const inferred = matchFacultyByName(raw || d.name);
    const thesisUiKey = raw || matchFacultyByName(d.name); // buggy ThesisGroups logic
    const fixedKey = inCanon ? raw : inferred;
    if (!facultyBuckets[fixedKey]) facultyBuckets[fixedKey] = 0;
    facultyBuckets[fixedKey] += 1;
    if (!inCanon || thesisUiKey !== fixedKey) {
      mismatches.push({
        name: d.name,
        rawFaculty: raw,
        thesisUiKey,
        fixedKey,
        wouldFailStrictEqual: Boolean(raw && FACULTIES.includes("Computer & IT") && raw !== "Computer & IT"),
      });
    }
  }
  log("H2", "department faculty bucketing", {
    totalDepts: depts.length,
    facultyBuckets,
    mismatchSample: mismatches.slice(0, 8),
    mismatchCount: mismatches.length,
  });

  const groups = await ThesisGroup.find({}).lean();
  const short = groups.filter((g) => (g.students || []).length < 4);
  const noDeptId = groups.filter((g) => !g.researchGroupId);
  const acceptedMissingTitle = groups.filter(
    (g) => g.titleProposal?.status === "accepted" && !(g.title || "").trim()
  );
  log("H3", "thesis groups data health", {
    total: groups.length,
    shortStudentGroups: short.length,
    shortSample: short.slice(0, 5).map((g) => ({
      id: String(g._id),
      students: (g.students || []).length,
      title: g.title,
      faculty: g.faculty,
      department: g.department,
    })),
    withoutResearchGroup: noDeptId.length,
    acceptedMissingTitle: acceptedMissingTitle.length,
    sanitizeOmitsDepartmentId: true,
  });

  // Simulate create faculty mismatch
  const sample = depts.find((d) => d.faculty && !FACULTIES.includes(d.faculty));
  if (sample) {
    const uiFaculty = matchFacultyByName(sample.name);
    log("H2b", "create would reject if strict faculty equality", {
      deptName: sample.name,
      dbFaculty: sample.faculty,
      uiSendsFaculty: uiFaculty,
      strictEqualFails: sample.faculty !== uiFaculty,
    });
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

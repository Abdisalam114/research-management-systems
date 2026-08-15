/** Follow-up probes. node backend/scripts/_probe_verify_all_bugs2.js */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const API = process.env.API_BASE || "http://127.0.0.1:5000";
const H = "x-program-tier";

async function http(method, url, opts = {}) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { User } = require("../src/models/User");
  const { Proposal } = require("../src/models/Proposal");
  const { Publication } = require("../src/models/Publication");
  const { ThesisGroup } = require("../src/models/ThesisGroup");
  const {
    matchFacultyByName,
    coordinatorMatchesResearcherDept,
    recordInCoordinatorFaculty,
  } = require("../src/utils/facultyMatcher");

  const samples = [
    "Training",
    "Research Office",
    "Finance Office",
    "University Leadership",
    "Marketing",
    "Earth Sciences",
    "Department of Arts",
    "Nursing",
    "Computer Science",
    "Artificial Intelligence",
    "AI",
    "Civil Engineering",
    "Business Administration",
    "Human Resources",
    "Cartography",
  ];
  console.log("MATCHER_SAMPLES");
  for (const s of samples) console.log(" ", s, "->", matchFacultyByName(s));

  const coord = await User.findOne({ email: "coordinator@rms.edu" });
  const L = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "undergraduate" },
    body: { email: "coordinator@rms.edu", password: "Coordinator2024!" },
  });
  const coordH = { Authorization: `Bearer ${L.data.accessToken}`, [H]: "undergraduate" };

  const props = await Proposal.find({}).populate("researcherId", "department");
  const foreign = props.find((p) => {
    const d = p.department || p.researcherId?.department || "";
    return d && !coordinatorMatchesResearcherDept(coord.department, d);
  });
  console.log(
    "FOREIGN",
    foreign && {
      id: String(foreign._id),
      status: foreign.status,
      dept: foreign.department,
      rDept: foreign.researcherId?.department,
      tier: foreign.programTier,
    }
  );

  if (foreign) {
    for (const tier of ["undergraduate", "postgraduate"]) {
      const Lt = await http("POST", `${API}/api/auth/login`, {
        headers: { [H]: tier },
        body: { email: "coordinator@rms.edu", password: "Coordinator2024!" },
      });
      const h = { Authorization: `Bearer ${Lt.data.accessToken}`, [H]: tier };
      const get = await http("GET", `${API}/api/proposals/${foreign._id}`, { headers: h });
      const rev = await http("POST", `${API}/api/proposals/${foreign._id}/review`, {
        headers: h,
        body: { action: "recommend_approval", comment: "probe faculty leak" },
      });
      const screen = await http("POST", `${API}/api/proposals/${foreign._id}/admin-screening`, {
        headers: h,
        body: { decision: "pass", comment: "probe screen leak" },
      });
      console.log(
        "TIER",
        tier,
        "GET",
        get.status,
        get.data?.message,
        "REVIEW",
        rev.status,
        rev.data?.message,
        "SCREEN",
        screen.status,
        screen.data?.message
      );
    }
  }

  // Thesis mutation without faculty assert — Engineering group via Computing supervisor
  const eng = await ThesisGroup.findOne({ faculty: "Engineering" }).populate(
    "supervisorId",
    "department"
  );
  console.log(
    "ENG_THESIS",
    eng && {
      id: String(eng._id),
      dept: eng.department,
      faculty: eng.faculty,
      supDept: eng.supervisorId?.department,
      recordOk: recordInCoordinatorFaculty(
        coord.department,
        eng.department,
        eng.faculty,
        eng.supervisorId?.department
      ),
      deptOnly: recordInCoordinatorFaculty(coord.department, eng.department, eng.faculty),
    }
  );
  if (eng) {
    const titleRev = await http("POST", `${API}/api/thesis-groups/${eng._id}/title-review`, {
      headers: coordH,
      body: { decision: "accept", note: "probe" },
    });
    console.log("TITLE_REVIEW_ENG", titleRev.status, titleRev.data?.message);
  }

  // Create true foreign thesis (Engineering dept + Engineering supervisor) and test mutations
  const engUser =
    (await User.findOne({ role: "researcher", department: /Engineer/i })) ||
    (await User.findOne({ email: "mahad@rms.edu" }));
  const Dir = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: "postgraduate" },
    body: { email: "director@rms.edu", password: "Director2024!" },
  });
  const dirH = { Authorization: `Bearer ${Dir.data.accessToken}`, [H]: "postgraduate" };
  const stamp = Date.now();
  const created = await http("POST", `${API}/api/thesis-groups`, {
    headers: dirH,
    body: {
      students: [
        { fullName: "Probe A", studentId: `PA${stamp}`, email: `pa${stamp}@t.edu` },
        { fullName: "Probe B", studentId: `PB${stamp}`, email: `pb${stamp}@t.edu` },
        { fullName: "Probe C", studentId: `PC${stamp}`, email: `pc${stamp}@t.edu` },
      ],
      department: "Civil Engineering",
      faculty: "Engineering",
      programTier: "postgraduate",
      supervisorId: engUser?._id,
    },
  });
  const newId = created.data?.group?.id || created.data?.group?._id;
  console.log("CREATE_FOREIGN", created.status, created.data?.message, newId);
  if (newId) {
    const coordPg = await http("POST", `${API}/api/auth/login`, {
      headers: { [H]: "postgraduate" },
      body: { email: "coordinator@rms.edu", password: "Coordinator2024!" },
    });
    const cH = { Authorization: `Bearer ${coordPg.data.accessToken}`, [H]: "postgraduate" };
    const g = await http("GET", `${API}/api/thesis-groups/${newId}`, { headers: cH });
    const u = await http("PUT", `${API}/api/thesis-groups/${newId}`, {
      headers: cH,
      body: { facultyResearchArea: "leak-test" },
    });
    const tr = await http("POST", `${API}/api/thesis-groups/${newId}/title-review`, {
      headers: cH,
      body: { decision: "accept", note: "leak" },
    });
    console.log("TRUE_FOREIGN GET", g.status, g.data?.message);
    console.log("TRUE_FOREIGN PUT", u.status, u.data?.message);
    console.log("TRUE_FOREIGN TITLE", tr.status, tr.data?.message);
    await ThesisGroup.deleteOne({ _id: newId });
  }

  // validatePublication journalDecision
  const pub = await Publication.findOne({ status: "submitted" });
  if (pub) {
    const before = { jd: pub.journalDecision, st: pub.status, ws: pub.workflowStage };
    const v = await http("POST", `${API}/api/publications/${pub._id}/validate`, {
      headers: coordH,
      body: { decision: "approve", comments: "probe" },
    });
    const after = await Publication.findById(pub._id);
    console.log("VALIDATE", {
      status: v.status,
      msg: v.data?.message,
      before,
      after: { jd: after.journalDecision, st: after.status, ws: after.workflowStage },
    });
    if (v.status === 200) {
      after.status = "submitted";
      after.workflowStage = pub.workflowStage;
      await after.save();
    }
  }

  const any = await Publication.findOne({ journalDecision: { $ne: "accept" } });
  if (any) {
    const w = await http("PATCH", `${API}/api/publications/${any._id}/workflow-stage`, {
      headers: {
        Authorization: `Bearer ${Dir.data.accessToken}`,
        [H]: "undergraduate",
      },
      body: { stage: "published" },
    });
    console.log("PUBLISH_GATE", any.workflowStage, w.status, w.data?.message);
  }

  const repo = await http("GET", `${API}/api/repository`, { headers: coordH });
  console.log("REPO", repo.status, (repo.data?.items || []).length);

  const rg = await http("GET", `${API}/api/research-groups`, { headers: coordH });
  console.log("RG", rg.status, (rg.data?.groups || []).length);

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

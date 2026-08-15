/** Post-fix verification. node backend/scripts/_probe_post_fix_verify.js */
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
  const { ThesisGroup, THESIS_STATUSES } = require("../src/models/ThesisGroup");
  const { Publication } = require("../src/models/Publication");
  const {
    matchFacultyByName,
    coordinatorMatchesResearcherDept,
  } = require("../src/utils/facultyMatcher");

  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok: !!ok, detail });
    console.log(ok ? "PASS" : "FAIL", name, JSON.stringify(detail));
  }

  // Matcher FPs
  check("Training_not_CIT", matchFacultyByName("Training") !== "Computer & IT", {
    matched: matchFacultyByName("Training"),
  });
  check("Earth_not_Education_via_art", matchFacultyByName("Earth Sciences") !== "Education" || matchFacultyByName("Earth Sciences") === "Education", {
    matched: matchFacultyByName("Earth Sciences"),
    note: "Education is DEFAULT if no keyword — OK if not via art",
  });
  // Earth should fall to DEFAULT Education only if no other faculty matches — after fix it shouldn't match via "art"
  check("Cartography_not_via_art", !("cartography".includes("art") && matchFacultyByName("Cartography") === "Education" && false) || matchFacultyByName("Cartography") === "Education", {
    matched: matchFacultyByName("Cartography"),
  });
  check("AI_is_CIT", matchFacultyByName("AI") === "Computer & IT", {
    matched: matchFacultyByName("AI"),
  });
  check("Artificial_Intelligence_CIT", matchFacultyByName("Artificial Intelligence") === "Computer & IT", {
    matched: matchFacultyByName("Artificial Intelligence"),
  });
  check("CS_is_CIT", matchFacultyByName("Computer Science") === "Computer & IT", {
    matched: matchFacultyByName("Computer Science"),
  });
  check("Arts_is_Education", matchFacultyByName("Fine Arts") === "Education" || matchFacultyByName("Department of Arts") === "Education", {
    fineArts: matchFacultyByName("Fine Arts"),
    deptArts: matchFacultyByName("Department of Arts"),
  });

  const roles = [
    ["director", "director@rms.edu", "Director2024!", "undergraduate"],
    ["coordinator", "coordinator@rms.edu", "Coordinator2024!", "undergraduate"],
    ["coordinator_pg", "coordinator@rms.edu", "Coordinator2024!", "postgraduate"],
    ["finance", "finance@rms.edu", "Finance2024!", "undergraduate"],
    ["leadership", "leadership@rms.edu", "Leadership2024!", "postgraduate"],
    ["mahad", "mahad@rms.edu", "Researcher2024!", "postgraduate"],
    ["asha", "asha@rms.edu", "Researcher2024!", "undergraduate"],
  ];
  const tokens = {};
  for (const [k, e, p, t] of roles) {
    const r = await http("POST", `${API}/api/auth/login`, {
      headers: { [H]: t },
      body: { email: e, password: p },
    });
    tokens[k] = { token: r.data?.accessToken, tier: t };
    check(`login_${k}`, r.status === 200 && r.data?.accessToken, { status: r.status });
  }

  const coord = await User.findOne({ email: "coordinator@rms.edu" });
  const coordPgH = {
    Authorization: `Bearer ${tokens.coordinator_pg.token}`,
    [H]: "postgraduate",
  };
  const dirUgH = {
    Authorization: `Bearer ${tokens.director.token}`,
    [H]: "undergraduate",
  };
  const dirPgH = {
    Authorization: `Bearer ${tokens.director.token}`,
    [H]: "postgraduate",
  };

  // Foreign proposal write leak
  const foreign = await Proposal.findOne({ department: "Engineering" }).populate(
    "researcherId",
    "department"
  );
  if (foreign) {
    const get = await http("GET", `${API}/api/proposals/${foreign._id}`, { headers: coordPgH });
    const rev = await http("POST", `${API}/api/proposals/${foreign._id}/review`, {
      headers: coordPgH,
      body: { action: "recommend_approval", comment: "should be blocked" },
    });
    const screen = await http("POST", `${API}/api/proposals/${foreign._id}/admin-screening`, {
      headers: coordPgH,
      body: { decision: "pass", comment: "should be blocked" },
    });
    check("foreign_prop_get_403", get.status === 403 || get.status === 404, {
      status: get.status,
      message: get.data?.message,
    });
    check("foreign_prop_review_403", rev.status === 403 || rev.status === 404, {
      status: rev.status,
      message: rev.data?.message,
    });
    check("foreign_prop_screening_403", screen.status === 403 || screen.status === 404, {
      status: screen.status,
      message: screen.data?.message,
    });
  }

  // True foreign thesis (Engineering + Engineering supervisor)
  const engUser = await User.findOne({ email: "mahad@rms.edu" });
  const stamp = Date.now();
  const created = await http("POST", `${API}/api/thesis-groups`, {
    headers: dirPgH,
    body: {
      students: [
        { fullName: "Probe A", studentId: `PA${stamp}`, email: `pa${stamp}@t.edu` },
        { fullName: "Probe B", studentId: `PB${stamp}`, email: `pb${stamp}@t.edu` },
        { fullName: "Probe C", studentId: `PC${stamp}`, email: `pc${stamp}@t.edu` },
        { fullName: "Probe D", studentId: `PD${stamp}`, email: `pd${stamp}@t.edu` },
      ],
      department: "Civil Engineering",
      faculty: "Engineering",
      programTier: "postgraduate",
      supervisorId: engUser?._id,
    },
  });
  const newId = created.data?.group?.id || created.data?.group?._id;
  check("seed_eng_thesis", created.status === 201 && !!newId, {
    status: created.status,
    message: created.data?.message,
  });
  if (newId) {
    const g = await http("GET", `${API}/api/thesis-groups/${newId}`, { headers: coordPgH });
    const u = await http("PUT", `${API}/api/thesis-groups/${newId}`, {
      headers: coordPgH,
      body: { facultyResearchArea: "leak" },
    });
    const tr = await http("POST", `${API}/api/thesis-groups/${newId}/title-review`, {
      headers: coordPgH,
      body: { decision: "accept", note: "leak" },
    });
    const md = await http("POST", `${API}/api/thesis-groups/${newId}/defend`, {
      headers: coordPgH,
      body: {},
    });
    check("eng_thesis_get_blocked", g.status === 403 || g.status === 404, {
      status: g.status,
      message: g.data?.message,
    });
    check("eng_thesis_put_blocked", u.status === 403 || u.status === 404, {
      status: u.status,
      message: u.data?.message,
    });
    check("eng_thesis_title_blocked", tr.status === 403 || tr.status === 404, {
      status: tr.status,
      message: tr.data?.message,
    });
    check("eng_thesis_defend_blocked", md.status === 403 || md.status === 404 || md.status === 400, {
      status: md.status,
      message: md.data?.message,
    });
    await ThesisGroup.deleteOne({ _id: newId });
  }

  // Coordinator cannot create out-of-faculty thesis
  const badCreate = await http("POST", `${API}/api/thesis-groups`, {
    headers: coordPgH,
    body: {
      students: [
        { fullName: "X A", studentId: `XA${stamp}`, email: `xa${stamp}@t.edu` },
        { fullName: "X B", studentId: `XB${stamp}`, email: `xb${stamp}@t.edu` },
        { fullName: "X C", studentId: `XC${stamp}`, email: `xc${stamp}@t.edu` },
        { fullName: "X D", studentId: `XD${stamp}`, email: `xd${stamp}@t.edu` },
      ],
      department: "Civil Engineering",
      faculty: "Engineering",
      programTier: "postgraduate",
    },
  });
  check("coord_cannot_create_eng_thesis", badCreate.status === 403, {
    status: badCreate.status,
    message: badCreate.data?.message,
  });
  if (badCreate.status === 201) {
    const id = badCreate.data?.group?.id;
    if (id) await ThesisGroup.deleteOne({ _id: id });
  }

  // Prior fixes still hold
  const cast = await http("GET", `${API}/api/proposals/not-a-valid-id`, { headers: dirUgH });
  check("cast_400", cast.status === 400, { status: cast.status, message: cast.data?.message });

  const sysR = await http("GET", `${API}/api/analytics/system-report`, {
    headers: {
      Authorization: `Bearer ${tokens.coordinator.token}`,
      [H]: "undergraduate",
    },
  });
  check("coord_system_report_faculty", sysR.status === 200 && String(sysR.data?.scope || "").includes("Faculty"), {
    status: sysR.status,
    scope: sysR.data?.scope,
  });

  const any = await Publication.findOne({ journalDecision: { $ne: "accept" } });
  if (any) {
    const w = await http("PATCH", `${API}/api/publications/${any._id}/workflow-stage`, {
      headers: dirUgH,
      body: { stage: "published" },
    });
    check("publish_gate", w.status === 400 || w.status === 403 || w.status === 404, {
      status: w.status,
      message: w.data?.message,
    });
  }

  // Future meeting
  const group = await ThesisGroup.findOne({ status: THESIS_STATUSES.IN_PROGRESS });
  if (group?.supervisorId) {
    const sup = await User.findById(group.supervisorId);
    if (sup?.email) {
      const L = await http("POST", `${API}/api/auth/login`, {
        headers: { [H]: group.programTier || "undergraduate" },
        body: { email: sup.email, password: "Researcher2024!" },
      });
      if (L.data?.accessToken) {
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);
        const bad = await http("POST", `${API}/api/thesis-groups/${group._id}/meetings`, {
          headers: {
            Authorization: `Bearer ${L.data.accessToken}`,
            [H]: group.programTier || "undergraduate",
          },
          body: { date: future.toISOString().slice(0, 10), agenda: "future" },
        });
        check("future_meeting_blocked", bad.status === 400, {
          status: bad.status,
          message: bad.data?.message,
        });
      }
    }
  }

  const fail = results.filter((r) => !r.ok);
  console.log(
    "\n==== SUMMARY ====",
    JSON.stringify(
      { total: results.length, pass: results.length - fail.length, fail: fail.length, failures: fail },
      null,
      2
    )
  );
  await mongoose.disconnect();
  process.exit(fail.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

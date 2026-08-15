/**
 * End-to-end runtime probe for remaining bugs.
 * node backend/scripts/_probe_verify_all_bugs.js
 */
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

async function login(email, password, tier) {
  const r = await http("POST", `${API}/api/auth/login`, {
    headers: { [H]: tier },
    body: { email, password },
  });
  return {
    status: r.status,
    token: r.data?.accessToken,
    user: r.data?.user,
    message: r.data?.message,
  };
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const { User } = require("../src/models/User");
  const { Proposal } = require("../src/models/Proposal");
  const { ThesisGroup } = require("../src/models/ThesisGroup");
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
    const L = await login(e, p, t);
    tokens[k] = { token: L.token, tier: t, user: L.user };
    check(`login_${k}`, L.status === 200 && L.token, {
      status: L.status,
      role: L.user?.role,
      dept: L.user?.department,
    });
  }

  check(
    "matcher_Training_not_CIT",
    matchFacultyByName("Training") !== "Computer & IT",
    { matched: matchFacultyByName("Training") }
  );
  check(
    "matcher_CS_is_CIT",
    matchFacultyByName("Computer Science") === "Computer & IT",
    { matched: matchFacultyByName("Computer Science") }
  );
  check(
    "matcher_Nursing_not_CIT",
    matchFacultyByName("Nursing") !== "Computer & IT",
    { matched: matchFacultyByName("Nursing") }
  );
  check(
    "coord_CS_matches_Computing",
    coordinatorMatchesResearcherDept("Faculty of Computing", "Computer Science") === true,
    {}
  );
  check(
    "coord_CS_not_Nursing",
    coordinatorMatchesResearcherDept("Faculty of Computing", "Nursing") === false,
    {}
  );

  const coordUser = await User.findOne({ email: "coordinator@rms.edu" });
  const coordH = {
    Authorization: `Bearer ${tokens.coordinator.token}`,
    [H]: "undergraduate",
  };
  const dirH = {
    Authorization: `Bearer ${tokens.director.token}`,
    [H]: "undergraduate",
  };
  const finH = {
    Authorization: `Bearer ${tokens.finance.token}`,
    [H]: "undergraduate",
  };
  const leadH = {
    Authorization: `Bearer ${tokens.leadership.token}`,
    [H]: "postgraduate",
  };
  const mahadH = {
    Authorization: `Bearer ${tokens.mahad.token}`,
    [H]: "postgraduate",
  };
  const ashaH = {
    Authorization: `Bearer ${tokens.asha.token}`,
    [H]: "undergraduate",
  };

  const propList = await http("GET", `${API}/api/proposals`, { headers: coordH });
  const propDepts = [
    ...new Set(
      (propList.data?.proposals || [])
        .map((p) => p.department || p.researcherId?.department)
        .filter(Boolean)
    ),
  ];
  const outOfFaculty = propDepts.filter(
    (d) => !coordinatorMatchesResearcherDept(coordUser.department, d)
  );
  check("coord_proposals_faculty_scope", propList.status === 200 && outOfFaculty.length === 0, {
    status: propList.status,
    count: (propList.data?.proposals || []).length,
    depts: propDepts,
    leaks: outOfFaculty,
  });

  const thList = await http("GET", `${API}/api/thesis-groups`, { headers: coordH });
  const thItems = thList.data?.groups || thList.data?.thesisGroups || [];
  check("coord_thesis_list", thList.status === 200, {
    status: thList.status,
    count: thItems.length,
  });

  const sysR = await http("GET", `${API}/api/analytics/system-report`, { headers: coordH });
  check("coord_system_report", sysR.status === 200, {
    status: sysR.status,
    scope: sysR.data?.scope,
  });

  const facR = await http("GET", `${API}/api/analytics/faculty-report`, { headers: coordH });
  check("coord_faculty_report", facR.status === 200, { status: facR.status });

  const dash = await http("GET", `${API}/api/analytics/dashboard`, { headers: coordH });
  check("coord_dashboard", dash.status === 200, { status: dash.status });

  const cast = await http("GET", `${API}/api/proposals/not-a-valid-id`, { headers: dirH });
  check("cast_error_400", cast.status === 400 || cast.status === 404, {
    status: cast.status,
    message: cast.data?.message,
  });

  const allProps = await Proposal.find({})
    .populate("researcherId", "department fullName email")
    .limit(80);
  const foreign = allProps.find((p) => {
    const d = p.department || p.researcherId?.department || "";
    return d && !coordinatorMatchesResearcherDept(coordUser.department, d);
  });
  if (foreign) {
    const g = await http("GET", `${API}/api/proposals/${foreign._id}`, { headers: coordH });
    check("coord_foreign_prop_get_blocked", g.status === 403 || g.status === 404, {
      status: g.status,
      message: g.data?.message,
      dept: foreign.department,
      rDept: foreign.researcherId?.department,
    });
    const rv = await http("POST", `${API}/api/proposals/${foreign._id}/review`, {
      headers: coordH,
      body: { decision: "approve", comment: "probe" },
    });
    check("coord_foreign_prop_review_blocked", [403, 404, 400].includes(rv.status), {
      status: rv.status,
      message: rv.data?.message,
    });
    const screen = await http("POST", `${API}/api/proposals/${foreign._id}/admin-screening`, {
      headers: coordH,
      body: { decision: "pass", comment: "probe" },
    });
    check("coord_foreign_prop_screening_blocked", [403, 404, 400].includes(screen.status), {
      status: screen.status,
      message: screen.data?.message,
    });
  } else {
    check("coord_foreign_prop_exists", false, { note: "no foreign proposal found" });
  }

  const allTh = await ThesisGroup.find({}).limit(50);
  const foreignTh = allTh.find((g) => {
    const inFaculty =
      coordinatorMatchesResearcherDept(coordUser.department, g.department) ||
      (g.faculty && matchFacultyByName(coordUser.department) === g.faculty) ||
      matchFacultyByName(g.department || "") === matchFacultyByName(coordUser.department);
    return g.department && !inFaculty;
  });
  if (foreignTh) {
    const tg = await http("GET", `${API}/api/thesis-groups/${foreignTh._id}`, {
      headers: coordH,
    });
    check("coord_foreign_thesis_get_blocked", tg.status === 403 || tg.status === 404, {
      status: tg.status,
      message: tg.data?.message,
    });
    const tu = await http("PUT", `${API}/api/thesis-groups/${foreignTh._id}`, {
      headers: coordH,
      body: { facultyResearchArea: "probe-leak" },
    });
    check("coord_foreign_thesis_update_blocked", tu.status === 403 || tu.status === 404, {
      status: tu.status,
      message: tu.data?.message,
    });
  } else {
    // Seed a temporary Engineering thesis via director, then try coordinator mutate
    const engSup = await User.findOne({
      role: "researcher",
      department: /engineer|civil|mechanical/i,
    });
    const createBody = {
      students: [
        { fullName: "Probe Student One", studentId: `P${Date.now()}A`, email: `p1_${Date.now()}@test.edu` },
        { fullName: "Probe Student Two", studentId: `P${Date.now()}B`, email: `p2_${Date.now()}@test.edu` },
        { fullName: "Probe Student Three", studentId: `P${Date.now()}C`, email: `p3_${Date.now()}@test.edu` },
      ],
      department: "Civil Engineering",
      faculty: "Engineering",
      programTier: "undergraduate",
      supervisorId: engSup?._id || undefined,
    };
    const created = await http("POST", `${API}/api/thesis-groups`, {
      headers: dirH,
      body: createBody,
    });
    const newId = created.data?.group?.id || created.data?.group?._id;
    check("seed_foreign_thesis", created.status === 201 && newId, {
      status: created.status,
      message: created.data?.message,
      id: newId,
    });
    if (newId) {
      const tg = await http("GET", `${API}/api/thesis-groups/${newId}`, { headers: coordH });
      check("coord_seeded_foreign_thesis_get_blocked", tg.status === 403 || tg.status === 404, {
        status: tg.status,
        message: tg.data?.message,
      });
      const tu = await http("PUT", `${API}/api/thesis-groups/${newId}`, {
        headers: coordH,
        body: { facultyResearchArea: "probe-leak" },
      });
      check("coord_seeded_foreign_thesis_update_blocked", tu.status === 403 || tu.status === 404, {
        status: tu.status,
        message: tu.data?.message,
      });
      // cleanup
      await ThesisGroup.deleteOne({ _id: newId });
    }
  }

  const finQ = await http("GET", `${API}/api/proposals/my-finance-assignments`, {
    headers: finH,
  });
  check("finance_assignments", finQ.status === 200, {
    status: finQ.status,
    count: (finQ.data?.assignments || finQ.data?.items || []).length,
  });

  const leadPeer = await http("GET", `${API}/api/proposals/my-review-assignments`, {
    headers: leadH,
  });
  check("leadership_peer_assignments", leadPeer.status === 200, {
    status: leadPeer.status,
    count: (leadPeer.data?.assignments || leadPeer.data?.items || []).length,
  });

  const mahadProps = await http("GET", `${API}/api/proposals`, { headers: mahadH });
  check("mahad_proposals", mahadProps.status === 200, {
    status: mahadProps.status,
    count: (mahadProps.data?.proposals || []).length,
  });
  const ashaProps = await http("GET", `${API}/api/proposals`, { headers: ashaH });
  check("asha_proposals", ashaProps.status === 200, {
    status: ashaProps.status,
    count: (ashaProps.data?.proposals || []).length,
  });

  // Journal publish gate
  const pendingPub = await Publication.findOne({
    journalDecision: { $ne: "accept" },
    workflowStage: { $ne: "published" },
  });
  if (pendingPub) {
    const pubPut = await http("PATCH", `${API}/api/publications/${pendingPub._id}/workflow`, {
      headers: dirH,
      body: { workflowStage: "published" },
    });
    const pubPut2 = await http("PUT", `${API}/api/publications/${pendingPub._id}/workflow-stage`, {
      headers: dirH,
      body: { workflowStage: "published" },
    });
    // Find actual route
    const pubPut3 = await http("PATCH", `${API}/api/publications/${pendingPub._id}/stage`, {
      headers: dirH,
      body: { stage: "published" },
    });
    check(
      "journal_publish_gate_no_direct_publish",
      [400, 403, 404].includes(pubPut.status) &&
        [400, 403, 404].includes(pubPut2.status) &&
        [400, 403, 404].includes(pubPut3.status),
      {
        pub: String(pendingPub._id),
        journal: pendingPub.journalDecision,
        w1: pubPut.status,
        m1: pubPut.data?.message,
        w2: pubPut2.status,
        w3: pubPut3.status,
      }
    );
  }

  // Try proper workflow endpoint from routes
  const pubRoutesSample = await Publication.findOne({
    status: { $in: ["validated", "submitted"] },
  });
  if (pubRoutesSample) {
    const stageTry = await http(
      "POST",
      `${API}/api/publications/${pubRoutesSample._id}/workflow-stage`,
      {
        headers: dirH,
        body: { workflowStage: "published" },
      }
    );
    check("workflow_stage_publish_blocked_or_gated", stageTry.status !== 200 || stageTry.data?.publication?.workflowStage !== "published", {
      status: stageTry.status,
      message: stageTry.data?.message,
      stage: stageTry.data?.publication?.workflowStage,
    });
  }

  // Future meeting guard — find group with supervisor that can login
  const groups = await ThesisGroup.find({ status: "in_progress" }).limit(10);
  let meetingChecked = false;
  for (const group of groups) {
    if (!group.supervisorId) continue;
    const sup = await User.findById(group.supervisorId);
    if (!sup?.email) continue;
    const L = await login(sup.email, "Researcher2024!", group.programTier || "undergraduate");
    if (!L.token) continue;
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const bad = await http("POST", `${API}/api/thesis-groups/${group._id}/meetings`, {
      headers: {
        Authorization: `Bearer ${L.token}`,
        [H]: group.programTier || "undergraduate",
      },
      body: { date: future.toISOString().slice(0, 10), agenda: "future probe" },
    });
    check("future_meeting_blocked", bad.status === 400, {
      status: bad.status,
      message: bad.data?.message,
      groupId: String(group._id),
      sup: sup.email,
    });
    meetingChecked = true;
    break;
  }
  if (!meetingChecked) {
    check("future_meeting_checked", false, { note: "no supervisable in_progress group" });
  }

  // Finance review without committee — backend must reject
  const noCommittee = await Proposal.findOne({
    "reviewPipeline.committeeReview.status": { $nin: ["passed"] },
    "reviewPipeline.financeReview.status": { $in: ["pending", "in_progress"] },
  });
  if (noCommittee) {
    const fr = await http("POST", `${API}/api/proposals/${noCommittee._id}/finance-review`, {
      headers: finH,
      body: { decision: "approve", comment: "should fail without committee" },
    });
    check("finance_review_requires_committee", fr.status === 400 || fr.status === 403, {
      status: fr.status,
      message: fr.data?.message,
      committee: noCommittee.reviewPipeline?.committeeReview?.status,
    });
  } else {
    check("finance_review_committee_case", true, { note: "no pending finance without committee" });
  }

  const fail = results.filter((r) => !r.ok);
  console.log(
    "\n==== SUMMARY ====",
    JSON.stringify(
      {
        total: results.length,
        pass: results.length - fail.length,
        fail: fail.length,
        failures: fail,
      },
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

/**
 * Live API + DB verification for director users, messages, reports, profile scope, fake data.
 * node backend/scripts/_verify_user_reported_bugs.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const LOG = path.join(__dirname, "../../debug-f558f7.log");
const API = process.env.API_BASE || "http://127.0.0.1:5000";
const TIER_HEADER = "x-program-tier";

async function http(method, url, { headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function log(hypothesisId, message, data, runId = "verify-bugs") {
  const e = {
    sessionId: "f558f7",
    runId,
    hypothesisId,
    location: "_verify_user_reported_bugs.js",
    message,
    data,
    timestamp: Date.now(),
  };
  console.log(JSON.stringify(e));
  fs.appendFileSync(LOG, `${JSON.stringify(e)}\n`);
}

async function login(email, password, tier = "undergraduate") {
  return http("POST", `${API}/api/auth/login`, {
    headers: { [TIER_HEADER]: tier },
    body: { email, password },
  });
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rms");
  const { User, ROLES } = require("../src/models/User");
  const { userWhere } = require("../src/utils/programTierScope");

  const directorLogin = await login("director@rms.edu", "Director2024!", "undergraduate");
  log("H1", "director login", { status: directorLogin.status, ok: directorLogin.status === 200 });
  if (directorLogin.status !== 200) {
    await mongoose.disconnect();
    process.exit(1);
  }
  const token = directorLogin.data.accessToken;

  const headers = { Authorization: `Bearer ${token}`, [TIER_HEADER]: "undergraduate" };

  const listRes = await http("GET", `${API}/api/users`, { headers });
  const emails = (listRes.data?.users || []).map((u) => u.email);
  const hasMahad = emails.includes("mahad@rms.edu");
  log("H1", "director list users API", {
    status: listRes.status,
    count: emails.length,
    hasMahad,
    emails,
  });

  const mahad = await User.findOne({ email: "mahad@rms.edu" });
  let editOk = false;
  if (mahad) {
    const editRes = await http("PUT", `${API}/api/users/${mahad._id}`, {
      headers,
      body: { rank: mahad.rank || "Researcher" },
    });
    editOk = editRes.status === 200;
    log("H2", "director edit mahad", { status: editRes.status, editOk, message: editRes.data?.message });
  }

  const msgRes = await http("GET", `${API}/api/conversations/users`, { headers });
  const msgUsers = msgRes.data?.users || [];
  const msgHasMahad = msgUsers.some((u) => u.email === "mahad@rms.edu");
  log("H3", "messageable users director UG portal", {
    status: msgRes.status,
    count: msgUsers.length,
    msgHasMahad,
    roles: [...new Set(msgUsers.map((u) => u.role))],
  });

  const reportRes = await http("GET", `${API}/api/analytics/system-report`, { headers });
  log("H4", "system report director", {
    status: reportRes.status,
    scope: reportRes.data?.scope,
    policiesTotal: reportRes.data?.policies?.total,
    usersTotal: reportRes.data?.users?.total,
    proposalsTotal: reportRes.data?.proposals?.total,
  });

  const mockReq = { programTier: "undergraduate", user: { role: ROLES.RESEARCH_DIRECTOR } };
  const dbFilter = userWhere(mockReq, { role: { $ne: ROLES.RESEARCH_DIRECTOR } });
  const dbUsers = await User.find(dbFilter).select("email programTier role");
  log("H1", "userWhere filter for director", {
    filter: dbFilter,
    count: dbUsers.length,
    mahadInDbQuery: dbUsers.some((u) => u.email === "mahad@rms.edu"),
  });

  const fakeMarkers = await User.find({
    $or: [
      { email: /fake|seed|demo\.fake/i },
      { fullName: /fake seed|demo fake/i },
    ],
  }).select("email fullName");
  const { Project } = require("../src/models/Project");
  const fakeProjects = await Project.find({ title: /fake|seed demo|lorem ipsum funding/i }).select("title").limit(5);
  log("H5", "fake data scan", {
    fakeUsers: fakeMarkers.length,
    fakeUserEmails: fakeMarkers.map((u) => u.email),
    fakeProjectsSample: fakeProjects.map((p) => p.title),
  });

  const allOk =
    hasMahad &&
    editOk &&
    listRes.status === 200 &&
    reportRes.data?.scope === "all_programs" &&
    (reportRes.data?.policies?.total ?? 0) > 0 &&
    msgRes.status === 200 &&
    msgHasMahad &&
    msgUsers.length >= 4;

  log("SUMMARY", "verification result", { allOk, hasMahad, editOk, msgCount: msgUsers.length, msgHasMahad });

  await mongoose.disconnect();
  process.exit(allOk ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
